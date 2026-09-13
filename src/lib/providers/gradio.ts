/**
 * Generic Hugging Face Space adapter. Introspects the Space's Gradio API and
 * maps our request onto its parameters by name, so any text-to-image or
 * text/image-to-video Space works without a bespoke integration.
 */
import { Client, handle_file } from "@gradio/client";
import { ProviderError, dataUrlToBuffer } from "./types";

interface JsApiData {
  label: string;
  parameter_name: string;
  parameter_default?: unknown;
  parameter_has_default?: boolean;
  type: string;
  component?: string;
}
interface EndpointInfo<T> {
  parameters: T[];
  returns: T[];
}

export interface GradioRunOptions {
  space: string;
  token?: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  inputImage?: string; // data URL
  duration?: number;
  aspect?: string;
  signal?: AbortSignal;
  onStatus?: (msg: string) => void;
}

export interface GradioOutput {
  url: string;
  mime: string;
  bytes: Buffer;
  endpoint: string;
  seed?: number;
}

const PROMPT_KEYS = ["prompt", "text", "positive_prompt", "caption", "description"];
const NEG_KEYS = ["negative_prompt", "negative", "neg_prompt"];
const SEED_KEYS = ["seed"];
const RANDOM_KEYS = ["randomize_seed", "random_seed"];
const WIDTH_KEYS = ["width", "image_width"];
const HEIGHT_KEYS = ["height", "image_height"];
const IMAGE_KEYS = ["image", "input_image", "init_image", "start_image", "image_input", "first_frame", "reference_image", "img"];
const DURATION_KEYS = ["duration", "duration_seconds", "num_seconds", "video_length", "length"];
const ASPECT_KEYS = ["aspect_ratio", "aspect", "resolution"];

function pickEndpoint(api: { named_endpoints: Record<string, EndpointInfo<JsApiData>> }, wantImageInput: boolean): [string, EndpointInfo<JsApiData>] {
  const entries = Object.entries(api.named_endpoints);
  if (!entries.length) throw new ProviderError("hf-space", "Space exposes no named API endpoints", undefined, false);
  const score = ([name, info]: [string, EndpointInfo<JsApiData>]) => {
    let s = 0;
    const names = info.parameters.map((p) => (p.parameter_name || p.label || "").toLowerCase());
    if (names.some((n) => PROMPT_KEYS.includes(n))) s += 10;
    if (wantImageInput && names.some((n) => IMAGE_KEYS.includes(n))) s += 5;
    if (!wantImageInput && names.some((n) => IMAGE_KEYS.includes(n))) s -= 1;
    if (/infer|generate|predict|run|txt2img|text2video|img2video|process/i.test(name)) s += 3;
    if (/example|load|clear|random|update|toggle|change|stop/i.test(name)) s -= 8;
    return s;
  };
  return entries.sort((a, b) => score(b) - score(a))[0];
}

export async function runGradio(opts: GradioRunOptions): Promise<GradioOutput> {
  const { space, token, onStatus } = opts;
  onStatus?.(`Connecting to ${space}…`);
  let client: Client;
  try {
    client = await Client.connect(space, {
      token: token && token.startsWith("hf_") ? (token as `hf_${string}`) : undefined,
      events: ["data", "status"],
      status_callback: (s) => onStatus?.(`Space ${s.status}${"detail" in s && s.detail ? `: ${s.detail}` : ""}`),
    });
  } catch (e) {
    throw new ProviderError("hf-space", `Could not connect to ${space}: ${e instanceof Error ? e.message : String(e)}`);
  }

  const api = await client.view_api();
  const [endpoint, info] = pickEndpoint(api, Boolean(opts.inputImage));

  const params: Record<string, unknown> = {};
  let promptSet = false;
  for (const p of info.parameters) {
    const key = (p.parameter_name || p.label || "").toLowerCase();
    const name = p.parameter_name || p.label;
    if (!name) continue;
    if (PROMPT_KEYS.includes(key) && !promptSet) {
      params[name] = opts.prompt;
      promptSet = true;
    } else if (NEG_KEYS.includes(key)) params[name] = opts.negativePrompt ?? "";
    else if (SEED_KEYS.includes(key)) params[name] = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    else if (RANDOM_KEYS.includes(key)) params[name] = opts.seed === undefined;
    else if (WIDTH_KEYS.includes(key) && opts.width) params[name] = opts.width;
    else if (HEIGHT_KEYS.includes(key) && opts.height) params[name] = opts.height;
    else if (IMAGE_KEYS.includes(key) && opts.inputImage) {
      const { buffer, mime } = dataUrlToBuffer(opts.inputImage);
      params[name] = handle_file(new Blob([new Uint8Array(buffer)], { type: mime }));
    } else if (DURATION_KEYS.includes(key) && opts.duration) params[name] = opts.duration;
    else if (ASPECT_KEYS.includes(key) && opts.aspect && typeof p.parameter_default === "string") params[name] = opts.aspect;
    else if (p.parameter_has_default) params[name] = p.parameter_default;
  }
  if (!promptSet) {
    // Fall back to the first string parameter
    const first = info.parameters.find((p) => p.type === "string");
    if (first) params[first.parameter_name || first.label] = opts.prompt;
  }

  onStatus?.(`Running ${endpoint} on ${space}…`);
  const job = client.submit(endpoint, params);
  let data: unknown[] | undefined;
  for await (const ev of job) {
    if (opts.signal?.aborted) {
      job.cancel();
      throw new ProviderError("hf-space", "Cancelled", undefined, false);
    }
    if (ev.type === "status") {
      const st = ev as { stage: string; position?: number; eta?: number; message?: string; progress_data?: { desc: string | null; progress: number | null }[] };
      if (st.stage === "pending" && st.position !== undefined) onStatus?.(`Queued on ${space} (position ${st.position}${st.eta ? `, ~${Math.round(st.eta)}s` : ""})`);
      else if (st.progress_data?.length) {
        const pd = st.progress_data[st.progress_data.length - 1];
        onStatus?.(`${pd.desc ?? "Generating"} ${pd.progress !== null ? Math.round(pd.progress * 100) + "%" : ""}`);
      } else if (st.stage === "error") throw new ProviderError("hf-space", typeof st.message === "string" ? st.message : "Space returned an error");
    } else if (ev.type === "data") {
      data = (ev as { data: unknown[] }).data;
    }
  }
  if (!data) throw new ProviderError("hf-space", "Space returned no data");

  const found = findFileOutput(data);
  if (!found) throw new ProviderError("hf-space", "Could not find an image/video in the Space output");
  const res = await fetch(found.url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, signal: opts.signal });
  if (!res.ok) throw new ProviderError("hf-space", `Failed to download output (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0] || guessMime(found.url);
  const seed = data.find((d) => typeof d === "number") as number | undefined;
  return { url: found.url, mime, bytes, endpoint, seed };
}

function guessMime(url: string): string {
  if (/\.mp4/i.test(url)) return "video/mp4";
  if (/\.webm/i.test(url)) return "video/webm";
  if (/\.png/i.test(url)) return "image/png";
  if (/\.jpe?g/i.test(url)) return "image/jpeg";
  if (/\.webp/i.test(url)) return "image/webp";
  return "application/octet-stream";
}

function findFileOutput(data: unknown): { url: string } | null {
  const visit = (v: unknown, depth: number): { url: string } | null => {
    if (depth > 6 || v === null || v === undefined) return null;
    if (typeof v === "string") return /^https?:\/\//.test(v) && /\.(png|jpe?g|webp|gif|mp4|webm)(\?|$)/i.test(v) ? { url: v } : null;
    if (Array.isArray(v)) {
      for (const item of v) {
        const r = visit(item, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.url === "string") return { url: o.url };
      if (o.video && typeof o.video === "object") return visit(o.video, depth + 1);
      if (o.image && typeof o.image === "object") return visit(o.image, depth + 1);
      for (const val of Object.values(o)) {
        const r = visit(val, depth + 1);
        if (r) return r;
      }
    }
    return null;
  };
  return visit(data, 0);
}

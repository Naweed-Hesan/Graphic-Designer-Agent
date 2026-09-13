/** Shared request/response contracts for generation providers (server side). */
import { z } from "zod";

export const ProviderSettingsSchema = z.object({
  providers: z.object({
    pollinations: z.object({ apiKey: z.string().default(""), imageModel: z.string().default("flux"), textModel: z.string().default("openai"), videoModel: z.string().default("") }).prefault({}),
    cloudflare: z.object({ accountId: z.string().default(""), apiToken: z.string().default(""), imageModel: z.string().default("@cf/black-forest-labs/flux-1-schnell"), textModel: z.string().default("@cf/meta/llama-3.3-70b-instruct-fp8-fast") }).prefault({}),
    gemini: z.object({ apiKey: z.string().default(""), imageModel: z.string().default("gemini-2.5-flash-image"), textModel: z.string().default("gemini-2.5-flash") }).prefault({}),
    huggingface: z.object({ token: z.string().default(""), imageSpace: z.string().default("black-forest-labs/FLUX.1-schnell"), videoSpace: z.string().default("Lightricks/ltx-2-distilled") }).prefault({}),
    openaiCompat: z.object({ baseUrl: z.string().default(""), apiKey: z.string().default(""), model: z.string().default(""), label: z.string().default("") }).prefault({}),
    claude: z.object({ model: z.string().default("") }).prefault({}),
  }).prefault({}),
  assistant: z.object({ provider: z.enum(["claude-agent", "pollinations", "gemini", "cloudflare", "openai-compat"]).default("claude-agent") }).prefault({}),
  image: z.object({ order: z.array(z.enum(["pollinations", "cloudflare", "gemini", "hf-space"])).default(["pollinations", "cloudflare", "gemini", "hf-space"]) }).prefault({}),
  video: z.object({ order: z.array(z.enum(["pollinations", "hf-space"])).default(["pollinations", "hf-space"]) }).prefault({}),
});
export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;

export type ImageProviderId = ProviderSettings["image"]["order"][number];
export type VideoProviderId = ProviderSettings["video"]["order"][number];

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  /** Optional source image (data URL) for edit / image-to-image */
  inputImage?: string;
  model?: string;
  /** Free-text purpose used for logging / prompt hints */
  purpose?: string;
}

export interface GeneratedImage {
  dataUrl: string;
  mime: string;
  width: number;
  height: number;
  provider: string;
  model: string;
  seed?: number;
}

export interface VideoRequest {
  prompt: string;
  /** Data URL of a start frame for image-to-video */
  inputImage?: string;
  duration: number;
  aspect: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  model?: string;
  seed?: number;
}

export interface GeneratedVideo {
  dataUrl: string;
  mime: string;
  provider: string;
  model: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string;
  isConfigured: (s: ProviderSettings) => boolean;
  supportsEdit: boolean;
  generate: (req: ImageRequest, s: ProviderSettings, signal?: AbortSignal) => Promise<GeneratedImage>;
}

export interface VideoProvider {
  id: VideoProviderId;
  label: string;
  isConfigured: (s: ProviderSettings) => boolean;
  supportsImageInput: boolean;
  generate: (req: VideoRequest, s: ProviderSettings, signal?: AbortSignal, onStatus?: (msg: string) => void) => Promise<GeneratedVideo>;
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public status?: number, public retryable = true) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}

export function parseSettingsHeader(h: string | null): ProviderSettings {
  if (!h) return ProviderSettingsSchema.parse({});
  try {
    const json = Buffer.from(h, "base64").toString("utf8");
    const parsed = ProviderSettingsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : ProviderSettingsSchema.parse({});
  } catch {
    return ProviderSettingsSchema.parse({});
  }
}

/** Merge server env fallbacks into settings so `.env` alone is enough to run. */
export function withEnvFallbacks(s: ProviderSettings): ProviderSettings {
  const e = process.env;
  const p = s.providers;
  return {
    ...s,
    providers: {
      ...p,
      pollinations: { ...p.pollinations, apiKey: p.pollinations.apiKey || e.POLLINATIONS_API_KEY || "" },
      cloudflare: {
        ...p.cloudflare,
        accountId: p.cloudflare.accountId || e.CLOUDFLARE_ACCOUNT_ID || "",
        apiToken: p.cloudflare.apiToken || e.CLOUDFLARE_API_TOKEN || "",
      },
      gemini: { ...p.gemini, apiKey: p.gemini.apiKey || e.GEMINI_API_KEY || "" },
      huggingface: { ...p.huggingface, token: p.huggingface.token || e.HF_TOKEN || "" },
      openaiCompat: {
        ...p.openaiCompat,
        baseUrl: p.openaiCompat.baseUrl || e.OPENAI_COMPAT_BASE_URL || "",
        apiKey: p.openaiCompat.apiKey || e.OPENAI_COMPAT_API_KEY || "",
        model: p.openaiCompat.model || e.OPENAI_COMPAT_MODEL || "",
      },
    },
  };
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 120_000, signal, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function bytesToDataUrl(bytes: ArrayBuffer | Uint8Array, mime: string): string {
  const buf = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(new Uint8Array(bytes));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1] || "application/octet-stream";
  const buffer = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { buffer, mime };
}

export function sniffImageMime(buf: Buffer, fallback = "image/png"): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.length >= 6 && buf.subarray(0, 6).toString() === "GIF89a") return "image/gif";
  const head = buf.subarray(0, 256).toString("utf8").trim();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return fallback;
}

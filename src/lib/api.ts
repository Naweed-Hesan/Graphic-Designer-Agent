"use client";
import { settingsHeader } from "@/lib/store/settings";
import type { GeneratedImage, GeneratedVideo } from "@/lib/providers/types";
import type { ChatEvent, ChatRequestBody } from "@/lib/ai/events";
import type { FontMeta } from "@/app/api/fonts/route";

export interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  inputImage?: string;
  provider?: "auto" | "pollinations" | "cloudflare" | "gemini" | "hf-space";
  model?: string;
  purpose?: string;
}

export interface Attempt { provider: string; ok: boolean; error?: string; ms: number }

export async function generateImage(params: ImageGenParams, signal?: AbortSignal): Promise<{ image: GeneratedImage; attempts: Attempt[] }> {
  const res = await fetch("/api/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...settingsHeader() },
    body: JSON.stringify(params),
    signal,
  });
  const json = await res.json();
  if (!res.ok) {
    const attempts: Attempt[] = json.attempts ?? [];
    const detail = attempts.map((a) => `${a.provider}: ${a.error ?? "ok"}`).join(" · ");
    throw new Error(json.error ? `${json.error}${detail ? ` — ${detail}` : ""}` : "Image generation failed");
  }
  return json;
}

export interface VideoGenParams {
  prompt: string;
  inputImage?: string;
  duration?: number;
  aspect?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  provider?: "auto" | "pollinations" | "hf-space";
  model?: string;
  seed?: number;
}

export async function generateVideo(params: VideoGenParams, onStatus?: (msg: string) => void, signal?: AbortSignal): Promise<{ video: GeneratedVideo; attempts: Attempt[] }> {
  const res = await fetch("/api/generate/video", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...settingsHeader() },
    body: JSON.stringify(params),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Video request failed (${res.status})`);
  let result: { video: GeneratedVideo; attempts: Attempt[] } | null = null;
  await readNdjson(res.body, (line) => {
    const o = line as { type: string; message?: string; video?: GeneratedVideo; attempts?: Attempt[] };
    if (o.type === "status" && o.message) onStatus?.(o.message);
    else if (o.type === "result" && o.video) result = { video: o.video, attempts: o.attempts ?? [] };
    else if (o.type === "error") throw new Error(`${o.message}${o.attempts ? " — " + o.attempts.map((a) => `${a.provider}: ${a.error}`).join(" · ") : ""}`);
  });
  if (!result) throw new Error("No video returned");
  return result;
}

export async function readNdjson(body: ReadableStream<Uint8Array>, onLine: (obj: unknown) => void): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.trim()) continue;
      try {
        onLine(JSON.parse(l));
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      }
    }
  }
  if (buf.trim()) {
    try {
      onLine(JSON.parse(buf));
    } catch {}
  }
}

export async function streamChat(body: ChatRequestBody, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...settingsHeader() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Chat request failed (${res.status})`);
  }
  await readNdjson(res.body, (o) => onEvent(o as ChatEvent));
}

let fontsCache: { fonts: FontMeta[]; source: string } | null = null;
export async function fetchFonts(): Promise<{ fonts: FontMeta[]; source: string }> {
  if (fontsCache) return fontsCache;
  const res = await fetch("/api/fonts");
  const json = await res.json();
  fontsCache = json;
  return json;
}

export async function fetchModels(provider: string, kind: "image" | "video" | "text"): Promise<{ id: string; label?: string }[]> {
  const res = await fetch(`/api/providers/models?provider=${provider}&kind=${kind}`, { headers: settingsHeader() });
  const json = await res.json();
  return json.models ?? [];
}

export async function fetchAiStatus(probe = false): Promise<{ claude: { available: boolean; model?: string; apiKeySource?: string; version?: string; error?: string } | null; env: Record<string, boolean> }> {
  const res = await fetch(`/api/ai/status${probe ? "?probe=1" : ""}`);
  return res.json();
}

/**
 * Pure helpers around image generation: provider metadata, size resolution,
 * seed handling, attempt reporting and asset naming. No DOM, no React.
 */
import { slugify } from "@/lib/utils";
import { aspectToSize, type ImagePurpose } from "./prompt-compiler";
import { type Aspect, PLATFORM_BY_ID, PURPOSE_IDS } from "./presets";

export type ProviderChoice = "auto" | "pollinations" | "cloudflare" | "gemini" | "hf-space";

export interface ProviderOption {
  id: ProviderChoice;
  label: string;
  note: string;
  supportsEdit: boolean;
  needsKey: boolean;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "auto", label: "Auto — fallback order", note: "Tries your configured providers in order until one succeeds. Change the order under Providers (⌘,).", supportsEdit: true, needsKey: false },
  { id: "pollinations", label: "Pollinations", note: "Free, no key needed. FLUX and Kontext models; supports image editing.", supportsEdit: true, needsKey: false },
  { id: "cloudflare", label: "Cloudflare Workers AI", note: "Free tier of 10,000 neurons/day (about 170 FLUX images). Needs an account ID and API token.", supportsEdit: false, needsKey: true },
  { id: "gemini", label: "Google Gemini", note: "Image generation and editing. Free-tier availability varies by model; needs an API key.", supportsEdit: true, needsKey: true },
  { id: "hf-space", label: "Hugging Face Space", note: "Free ZeroGPU queue — slow but dependable. A read token raises the quota.", supportsEdit: false, needsKey: false },
];

export const PROVIDER_BY_ID = Object.fromEntries(PROVIDER_OPTIONS.map((p) => [p.id, p])) as Record<ProviderChoice, ProviderOption>;
export const EDIT_PROVIDERS = PROVIDER_OPTIONS.filter((p) => p.supportsEdit).map((p) => p.id);

export interface AttemptInfo {
  provider: string;
  ok: boolean;
  error?: string;
  ms?: number;
}

/**
 * `generateImage` folds the server's attempt list into the thrown message as
 * "<error> — provider: reason · provider: reason". Recover it for display.
 */
export function parseAttemptsFromError(message: string): { summary: string; attempts: AttemptInfo[] } {
  const idx = message.indexOf(" — ");
  if (idx < 0) return { summary: message, attempts: [] };
  const summary = message.slice(0, idx).trim();
  const attempts = message
    .slice(idx + 3)
    .split(" · ")
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map<AttemptInfo>((seg) => {
      const m = /^([a-z0-9-]+):\s*([\s\S]*)$/i.exec(seg);
      if (!m) return { provider: "unknown", ok: false, error: seg };
      const ok = m[2] === "ok";
      return { provider: m[1], ok, error: ok ? undefined : m[2] };
    });
  return { summary, attempts };
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Turns an attempt list into "pollinations failed: … → trying cloudflare" lines. */
export function narrateAttempts(attempts: AttemptInfo[]): string[] {
  return attempts.map((a, i) => {
    const next = attempts[i + 1];
    if (a.ok) return `${a.provider} succeeded${a.ms != null ? ` in ${formatMs(a.ms)}` : ""}`;
    const tail = next ? ` → trying ${next.provider}` : "";
    return `${a.provider} failed: ${a.error ?? "unknown error"}${tail}`;
  });
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export interface ResolvedSize {
  width: number;
  height: number;
  /** Human label, e.g. "Instagram Story" or "16:9" */
  label: string;
  aspect: string;
}

/** Size select values: "auto" | "aspect:<Aspect>" | "platform:<id>". */
export function resolveSize(choice: string, hint: Aspect, base = 1024): ResolvedSize {
  if (choice.startsWith("platform:")) {
    const p = PLATFORM_BY_ID[choice.slice("platform:".length)];
    if (p) return { width: p.width, height: p.height, label: `${p.platform} ${p.label}`, aspect: ratioLabel(p.width, p.height) };
  }
  const aspect = choice.startsWith("aspect:") ? (choice.slice("aspect:".length) as Aspect) : hint;
  const { width, height } = aspectToSize(aspect, base);
  return { width, height, label: choice === "auto" ? `${aspect} (from purpose)` : aspect, aspect };
}

export function ratioLabel(w: number, h: number): string {
  const g = gcd(w, h);
  const a = w / g;
  const b = h / g;
  if (a > 40 || b > 40) return `${(w / h).toFixed(2)}:1`;
  return `${a}:${b}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Fits an arbitrary image size into the API's 256–2048 range (multiples of 16)
 * while keeping the aspect ratio — used for edits and variations of uploads.
 */
export function fitSizeForApi(width?: number, height?: number, max = 1024): { width: number; height: number } {
  const w = width && width > 0 ? width : 1024;
  const h = height && height > 0 ? height : 1024;
  let scale = Math.min(1, max / Math.max(w, h));
  const minScale = 256 / Math.min(w, h);
  if (minScale > scale) scale = Math.min(minScale, 2048 / Math.max(w, h));
  const r16 = (n: number) => Math.min(2048, Math.max(256, Math.round((n * scale) / 16) * 16));
  return { width: r16(w), height: r16(h) };
}

export function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "png";
}

export function generationAssetName(purpose: ImagePurpose, subject: string, seed: number | undefined, mime: string): string {
  const base = slugify(subject).slice(0, 40).replace(/-$/, "") || purpose;
  return `${purpose}-${base}${seed != null ? `-${seed}` : ""}.${extForMime(mime)}`;
}

/** "hero-steam.png" → "hero-steam-cutout.png" */
export function deriveAssetName(name: string, suffix: string, ext = "png"): string {
  const stem = name.replace(/\.[a-z0-9]+$/i, "");
  return `${stem}-${suffix}.${ext}`;
}

export function purposeFromTags(tags: string[]): ImagePurpose | null {
  const t = tags.find((x) => PURPOSE_IDS.has(x));
  return (t as ImagePurpose | undefined) ?? null;
}

/** Tags that describe how an image came to be, rather than what it is for. */
export const ORIGIN_TAGS = ["ai", "upload", "cutout", "edit", "variation", "moodboard"] as const;

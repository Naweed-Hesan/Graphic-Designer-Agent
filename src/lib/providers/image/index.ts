import { type GeneratedImage, type ImageProvider, type ImageProviderId, type ImageRequest, type ProviderSettings, ProviderError } from "../types";
import { pollinationsImage } from "./pollinations";
import { cloudflareImage } from "./cloudflare";
import { geminiImage } from "./gemini";
import { hfSpaceImage } from "./hf-space";

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  pollinations: pollinationsImage,
  cloudflare: cloudflareImage,
  gemini: geminiImage,
  "hf-space": hfSpaceImage,
};

export interface ImageChainResult {
  image: GeneratedImage | null;
  attempts: { provider: string; ok: boolean; error?: string; ms: number }[];
}

/**
 * Try providers in the user's preferred order until one succeeds.
 * `preferred` pins a single provider (no fallback) when set to anything but "auto".
 */
export async function generateImageWithFallback(
  req: ImageRequest,
  settings: ProviderSettings,
  preferred: ImageProviderId | "auto" = "auto",
  signal?: AbortSignal,
): Promise<ImageChainResult> {
  const order: ImageProviderId[] = preferred === "auto" ? settings.image.order : [preferred];
  const attempts: ImageChainResult["attempts"] = [];
  for (const id of order) {
    const p = IMAGE_PROVIDERS[id];
    if (!p) continue;
    if (!p.isConfigured(settings)) {
      attempts.push({ provider: id, ok: false, error: "not configured", ms: 0 });
      continue;
    }
    if (req.inputImage && !p.supportsEdit) {
      attempts.push({ provider: id, ok: false, error: "does not support image editing", ms: 0 });
      continue;
    }
    const t0 = Date.now();
    try {
      const image = await p.generate(req, settings, signal);
      attempts.push({ provider: id, ok: true, ms: Date.now() - t0 });
      return { image, attempts };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push({ provider: id, ok: false, error: msg, ms: Date.now() - t0 });
      if (signal?.aborted) break;
      if (e instanceof ProviderError && !e.retryable && preferred !== "auto") break;
    }
  }
  return { image: null, attempts };
}

import { type GeneratedVideo, type VideoProvider, type VideoProviderId, type VideoRequest, type ProviderSettings } from "../types";
import { pollinationsVideo } from "./pollinations";
import { hfSpaceVideo } from "./hf-space";

export const VIDEO_PROVIDERS: Record<VideoProviderId, VideoProvider> = {
  pollinations: pollinationsVideo,
  "hf-space": hfSpaceVideo,
};

export interface VideoChainResult {
  video: GeneratedVideo | null;
  attempts: { provider: string; ok: boolean; error?: string; ms: number }[];
}

export async function generateVideoWithFallback(
  req: VideoRequest,
  settings: ProviderSettings,
  preferred: VideoProviderId | "auto" = "auto",
  signal?: AbortSignal,
  onStatus?: (msg: string) => void,
): Promise<VideoChainResult> {
  const order: VideoProviderId[] = preferred === "auto" ? settings.video.order : [preferred];
  const attempts: VideoChainResult["attempts"] = [];
  for (const id of order) {
    const p = VIDEO_PROVIDERS[id];
    if (!p || !p.isConfigured(settings)) {
      attempts.push({ provider: id, ok: false, error: "not configured", ms: 0 });
      continue;
    }
    if (req.inputImage && !p.supportsImageInput) {
      attempts.push({ provider: id, ok: false, error: "no image input", ms: 0 });
      continue;
    }
    const t0 = Date.now();
    try {
      onStatus?.(`Trying ${p.label}…`);
      const video = await p.generate(req, settings, signal, onStatus);
      attempts.push({ provider: id, ok: true, ms: Date.now() - t0 });
      return { video, attempts };
    } catch (e) {
      attempts.push({ provider: id, ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
      if (signal?.aborted) break;
    }
  }
  return { video: null, attempts };
}

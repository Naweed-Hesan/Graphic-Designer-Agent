import { type VideoProvider, ProviderError, fetchWithTimeout, bytesToDataUrl, dataUrlToBuffer } from "../types";
import { POLLINATIONS_BASE } from "../image/pollinations";

async function uploadToMedia(dataUrl: string, key: string, signal?: AbortSignal): Promise<string> {
  const { buffer, mime } = dataUrlToBuffer(dataUrl);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), "frame.png");
  const res = await fetchWithTimeout("https://media.pollinations.ai/upload", {
    method: "POST",
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
    body: form,
    signal,
    timeoutMs: 60_000,
  });
  if (!res.ok) throw new ProviderError("pollinations", `Upload failed (${res.status})`, res.status);
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.url || j.id ? j.url || `https://media.pollinations.ai/${j.id}` : text.trim();
  } catch {
    return text.trim();
  }
}

export const pollinationsVideo: VideoProvider = {
  id: "pollinations",
  label: "Pollinations video (free weekly Pollen with a key)",
  supportsImageInput: true,
  isConfigured: () => true,
  async generate(req, s, signal, onStatus) {
    const cfg = s.providers.pollinations;
    const key = cfg.apiKey.trim();
    const params = new URLSearchParams({ duration: String(Math.max(1, Math.min(20, Math.round(req.duration)))), aspectRatio: req.aspect });
    const model = req.model || cfg.videoModel;
    if (model) params.set("model", model);
    if (req.seed !== undefined) params.set("seed", String(req.seed));
    if (key) params.set("key", key);
    if (req.inputImage) {
      onStatus?.("Uploading start frame…");
      params.set("image", await uploadToMedia(req.inputImage, key, signal));
    }
    onStatus?.("Rendering video on Pollinations… this can take a few minutes");
    const url = `${POLLINATIONS_BASE}/video/${encodeURIComponent(req.prompt)}?${params.toString()}`;
    const res = await fetchWithTimeout(url, { signal, timeoutMs: 600_000 });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let msg = text.slice(0, 300) || res.statusText;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.message || msg;
      } catch {}
      if (res.status === 401 || res.status === 402) msg += " — video models spend Pollen. Get a free key at enter.pollinations.ai (free weekly Pollen) and add it in Settings.";
      throw new ProviderError("pollinations", msg, res.status, false);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type")?.split(";")[0] || "video/mp4";
    if (!mime.startsWith("video/")) throw new ProviderError("pollinations", `Unexpected response type ${mime}`);
    return { dataUrl: bytesToDataUrl(buf, mime), mime, provider: "pollinations", model: model || "default", duration: req.duration };
  },
};

import { type ImageProvider, ProviderError, fetchWithTimeout, bytesToDataUrl, dataUrlToBuffer, sniffImageMime } from "../types";

export const POLLINATIONS_BASE = "https://gen.pollinations.ai";

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    return j.error?.message || j.message || j.error || text.slice(0, 200);
  } catch {
    return text.slice(0, 200) || res.statusText;
  }
}

export const pollinationsImage: ImageProvider = {
  id: "pollinations",
  label: "Pollinations (free, no key needed)",
  supportsEdit: true,
  isConfigured: () => true,
  async generate(req, s, signal) {
    const cfg = s.providers.pollinations;
    const key = cfg.apiKey.trim();
    const model = req.model || cfg.imageModel || "flux";

    if (req.inputImage) {
      // Image editing via the OpenAI-compatible edits endpoint (multipart).
      const { buffer, mime } = dataUrlToBuffer(req.inputImage);
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(buffer)], { type: mime }), "input.png");
      form.append("prompt", req.prompt);
      form.append("model", model === "flux" ? "kontext" : model);
      form.append("size", `${req.width}x${req.height}`);
      form.append("response_format", "b64_json");
      const res = await fetchWithTimeout(`${POLLINATIONS_BASE}/v1/images/edits`, {
        method: "POST",
        headers: key ? { Authorization: `Bearer ${key}` } : undefined,
        body: form,
        signal,
        timeoutMs: 180_000,
      });
      if (!res.ok) throw new ProviderError("pollinations", await readError(res), res.status, res.status !== 401 && res.status !== 402);
      const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
      const item = json.data?.[0];
      if (item?.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}`, mime: "image/png", width: req.width, height: req.height, provider: "pollinations", model, seed: req.seed };
      if (item?.url) {
        const r2 = await fetchWithTimeout(item.url, { signal });
        const buf = Buffer.from(await r2.arrayBuffer());
        const m = sniffImageMime(buf, "image/jpeg");
        return { dataUrl: bytesToDataUrl(buf, m), mime: m, width: req.width, height: req.height, provider: "pollinations", model, seed: req.seed };
      }
      throw new ProviderError("pollinations", "Edit returned no image");
    }

    const seed = req.seed ?? Math.floor(Math.random() * 1_000_000);
    const params = new URLSearchParams({
      model,
      width: String(req.width),
      height: String(req.height),
      seed: String(seed),
      nologo: "true",
      referrer: "ligature-studio",
    });
    if (req.negativePrompt) params.set("negative_prompt", req.negativePrompt);
    if (key) params.set("key", key);
    const url = `${POLLINATIONS_BASE}/image/${encodeURIComponent(req.prompt)}?${params.toString()}`;

    let res = await fetchWithTimeout(url, { signal, timeoutMs: 180_000 });
    if (res.status === 429) {
      const wait = Math.min(20, Number(res.headers.get("retry-after") || 8));
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await fetchWithTimeout(url, { signal, timeoutMs: 180_000 });
    }
    if (!res.ok) {
      const msg = await readError(res);
      const hint = res.status === 402 ? " — this model needs Pollen; switch to 'flux' or add a free key from enter.pollinations.ai" : "";
      throw new ProviderError("pollinations", `${msg}${hint}`, res.status, res.status !== 402);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = sniffImageMime(buf, res.headers.get("content-type")?.split(";")[0] || "image/jpeg");
    if (!mime.startsWith("image/")) throw new ProviderError("pollinations", "Unexpected non-image response");
    return { dataUrl: bytesToDataUrl(buf, mime), mime, width: req.width, height: req.height, provider: "pollinations", model, seed };
  },
};

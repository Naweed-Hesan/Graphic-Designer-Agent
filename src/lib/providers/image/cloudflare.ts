import { type ImageProvider, ProviderError, fetchWithTimeout, bytesToDataUrl, sniffImageMime } from "../types";

export const cloudflareImage: ImageProvider = {
  id: "cloudflare",
  label: "Cloudflare Workers AI (free 10k neurons/day)",
  supportsEdit: false,
  isConfigured: (s) => Boolean(s.providers.cloudflare.accountId && s.providers.cloudflare.apiToken),
  async generate(req, s, signal) {
    const { accountId, apiToken } = s.providers.cloudflare;
    const model = req.model || s.providers.cloudflare.imageModel || "@cf/black-forest-labs/flux-1-schnell";
    const isFlux = /flux/i.test(model);
    const body = isFlux
      ? { prompt: req.prompt.slice(0, 2048), steps: 4 }
      : {
          prompt: req.prompt,
          negative_prompt: req.negativePrompt,
          width: Math.min(2048, req.width),
          height: Math.min(2048, req.height),
          num_steps: 20,
          seed: req.seed,
        };
    const res = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
      timeoutMs: 120_000,
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        msg = j.errors?.map((e: { message: string }) => e.message).join("; ") || msg;
      } catch {}
      throw new ProviderError("cloudflare", msg, res.status, res.status !== 401 && res.status !== 403);
    }
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { result?: { image?: string }; success?: boolean; errors?: { message: string }[] };
      const b64 = j.result?.image;
      if (!b64) throw new ProviderError("cloudflare", j.errors?.[0]?.message || "No image in response");
      const buf = Buffer.from(b64, "base64");
      const mime = sniffImageMime(buf, "image/jpeg");
      // FLUX schnell on Workers AI renders 1024×1024 regardless of request.
      return { dataUrl: bytesToDataUrl(buf, mime), mime, width: isFlux ? 1024 : req.width, height: isFlux ? 1024 : req.height, provider: "cloudflare", model, seed: req.seed };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = sniffImageMime(buf, "image/png");
    return { dataUrl: bytesToDataUrl(buf, mime), mime, width: req.width, height: req.height, provider: "cloudflare", model, seed: req.seed };
  },
};

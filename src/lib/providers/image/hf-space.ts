import { type ImageProvider, ProviderError, bytesToDataUrl } from "../types";
import { runGradio } from "../gradio";

export const hfSpaceImage: ImageProvider = {
  id: "hf-space",
  label: "Hugging Face Space (Gradio, free GPU queue)",
  supportsEdit: false,
  isConfigured: (s) => Boolean(s.providers.huggingface.imageSpace),
  async generate(req, s, signal) {
    const space = req.model || s.providers.huggingface.imageSpace;
    const out = await runGradio({
      space,
      token: s.providers.huggingface.token || undefined,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
      signal,
    });
    if (!out.mime.startsWith("image/")) throw new ProviderError("hf-space", `Space returned ${out.mime}, expected an image`);
    return { dataUrl: bytesToDataUrl(out.bytes, out.mime), mime: out.mime, width: req.width, height: req.height, provider: "hf-space", model: space, seed: out.seed ?? req.seed };
  },
};

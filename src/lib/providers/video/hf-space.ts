import { type VideoProvider, ProviderError, bytesToDataUrl } from "../types";
import { runGradio } from "../gradio";

export const hfSpaceVideo: VideoProvider = {
  id: "hf-space",
  label: "Hugging Face Space (LTX-2 / Wan, free GPU queue)",
  supportsImageInput: true,
  isConfigured: (s) => Boolean(s.providers.huggingface.videoSpace),
  async generate(req, s, signal, onStatus) {
    const space = req.model || s.providers.huggingface.videoSpace;
    const out = await runGradio({
      space,
      token: s.providers.huggingface.token || undefined,
      prompt: req.prompt,
      inputImage: req.inputImage,
      duration: req.duration,
      aspect: req.aspect,
      seed: req.seed,
      signal,
      onStatus,
    });
    if (!out.mime.startsWith("video/")) throw new ProviderError("hf-space", `Space returned ${out.mime}, expected a video`);
    return { dataUrl: bytesToDataUrl(out.bytes, out.mime), mime: out.mime, provider: "hf-space", model: space, duration: req.duration };
  },
};

import { GoogleGenAI } from "@google/genai";
import { type ImageProvider, ProviderError, dataUrlToBuffer } from "../types";

function nearestAspect(w: number, h: number): string {
  const r = w / h;
  const options: [string, number][] = [["1:1", 1], ["16:9", 16 / 9], ["9:16", 9 / 16], ["4:3", 4 / 3], ["3:4", 3 / 4], ["3:2", 1.5], ["2:3", 2 / 3], ["21:9", 21 / 9]];
  return options.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

export const geminiImage: ImageProvider = {
  id: "gemini",
  label: "Google Gemini (Nano Banana)",
  supportsEdit: true,
  isConfigured: (s) => Boolean(s.providers.gemini.apiKey),
  async generate(req, s, signal) {
    const { apiKey } = s.providers.gemini;
    const model = req.model || s.providers.gemini.imageModel || "gemini-2.5-flash-image";
    const ai = new GoogleGenAI({ apiKey });
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
    if (req.inputImage) {
      const { buffer, mime } = dataUrlToBuffer(req.inputImage);
      parts.push({ inlineData: { mimeType: mime, data: buffer.toString("base64") } });
    }
    parts.push({ text: req.negativePrompt ? `${req.prompt}\n\nAvoid: ${req.negativePrompt}` : req.prompt });
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: nearestAspect(req.width, req.height) },
          abortSignal: signal,
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) {
        const txt = res.text || res.promptFeedback?.blockReason || "No image returned";
        throw new ProviderError("gemini", String(txt).slice(0, 300), undefined, false);
      }
      const mime = part.inlineData.mimeType || "image/png";
      return { dataUrl: `data:${mime};base64,${part.inlineData.data}`, mime, width: req.width, height: req.height, provider: "gemini", model, seed: req.seed };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      const status = /429|RESOURCE_EXHAUSTED/.test(msg) ? 429 : /403|PERMISSION_DENIED|API key/i.test(msg) ? 403 : undefined;
      throw new ProviderError("gemini", msg.slice(0, 300), status, status !== 403);
    }
  },
};

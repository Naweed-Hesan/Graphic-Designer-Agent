import { NextRequest } from "next/server";
import { z } from "zod";
import { parseSettingsHeader, withEnvFallbacks } from "@/lib/providers/types";
import { generateVideoWithFallback } from "@/lib/providers/video";

export const runtime = "nodejs";
export const maxDuration = 600;

const Body = z.object({
  prompt: z.string().min(1).max(4000),
  inputImage: z.string().startsWith("data:").optional(),
  duration: z.number().min(1).max(20).default(5),
  aspect: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).default("16:9"),
  provider: z.enum(["auto", "pollinations", "hf-space"]).default("auto"),
  model: z.string().optional(),
  seed: z.number().int().optional(),
});

/** Streams NDJSON status lines, then a final {type:"result"} or {type:"error"}. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const settings = withEnvFallbacks(parseSettingsHeader(req.headers.get("x-ligature-settings")));
  const { provider, ...rest } = parsed.data;
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const result = await generateVideoWithFallback(rest, settings, provider, req.signal, (message) => send({ type: "status", message }));
        if (!result.video) send({ type: "error", message: "All video providers failed", attempts: result.attempts });
        else send({ type: "result", video: result.video, attempts: result.attempts });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

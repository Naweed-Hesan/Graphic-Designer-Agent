import { NextRequest } from "next/server";
import { z } from "zod";
import { parseSettingsHeader, withEnvFallbacks } from "@/lib/providers/types";
import { Genome } from "@/lib/genome/schema";
import { runAssistant } from "@/lib/ai/router";
import type { ChatEvent, ChatRequestBody } from "@/lib/ai/events";
import type { ToolContext } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 600;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
  genome: z.unknown(),
  assets: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string(), stage: z.string(), prompt: z.string().optional() })).default([]),
  stage: z.string().optional(),
  sessionId: z.string().optional(),
  provider: z.enum(["claude-agent", "pollinations", "gemini", "cloudflare", "openai-compat"]).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const genome = Genome.safeParse(parsed.data.genome);
  if (!genome.success) return Response.json({ error: "Invalid genome", issues: genome.error.issues }, { status: 400 });
  const settings = withEnvFallbacks(parseSettingsHeader(req.headers.get("x-ligature-settings")));
  const body = parsed.data as ChatRequestBody;

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: ChatEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      const ctx: ToolContext = { genome: genome.data, assets: body.assets, settings, stage: body.stage, emit, signal: req.signal };
      try {
        await runAssistant(body, settings, ctx, emit);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

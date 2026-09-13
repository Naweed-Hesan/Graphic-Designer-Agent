import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseSettingsHeader, withEnvFallbacks } from "@/lib/providers/types";
import { generateImageWithFallback } from "@/lib/providers/image";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional(),
  width: z.number().int().min(256).max(2048).default(1024),
  height: z.number().int().min(256).max(2048).default(1024),
  seed: z.number().int().optional(),
  inputImage: z.string().startsWith("data:").optional(),
  provider: z.enum(["auto", "pollinations", "cloudflare", "gemini", "hf-space"]).default("auto"),
  model: z.string().optional(),
  purpose: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const settings = withEnvFallbacks(parseSettingsHeader(req.headers.get("x-ligature-settings")));
  const { provider, ...rest } = parsed.data;
  const result = await generateImageWithFallback(rest, settings, provider, req.signal);
  if (!result.image) {
    return NextResponse.json(
      { error: "All image providers failed", attempts: result.attempts },
      { status: 502 },
    );
  }
  return NextResponse.json({ image: result.image, attempts: result.attempts });
}

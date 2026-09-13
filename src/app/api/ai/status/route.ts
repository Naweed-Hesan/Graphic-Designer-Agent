import { NextRequest, NextResponse } from "next/server";
import { probeClaude } from "@/lib/ai/claude-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

type Probe = Awaited<ReturnType<typeof probeClaude>> & { checkedAt: number };
const g = globalThis as unknown as { __ligatureClaudeProbe?: Probe; __ligatureClaudeInflight?: Promise<Probe> };

export async function GET(req: NextRequest) {
  const wantProbe = req.nextUrl.searchParams.get("probe") === "1";
  const env = {
    pollinations: Boolean(process.env.POLLINATIONS_API_KEY),
    cloudflare: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    huggingface: Boolean(process.env.HF_TOKEN),
    openaiCompat: Boolean(process.env.OPENAI_COMPAT_BASE_URL),
    anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
  };
  let claude: Probe | null = g.__ligatureClaudeProbe ?? null;
  const stale = !claude || Date.now() - claude.checkedAt > 10 * 60_000;
  if (wantProbe && stale) {
    if (!g.__ligatureClaudeInflight) {
      g.__ligatureClaudeInflight = probeClaude().then((r) => {
        const p = { ...r, checkedAt: Date.now() };
        g.__ligatureClaudeProbe = p;
        g.__ligatureClaudeInflight = undefined;
        return p;
      });
    }
    claude = await g.__ligatureClaudeInflight;
  }
  return NextResponse.json({ claude, env, platform: process.platform, node: process.version });
}

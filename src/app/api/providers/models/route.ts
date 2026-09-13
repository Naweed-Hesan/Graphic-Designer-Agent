import { NextRequest, NextResponse } from "next/server";
import { parseSettingsHeader, withEnvFallbacks, fetchWithTimeout } from "@/lib/providers/types";
import { POLLINATIONS_BASE } from "@/lib/providers/image/pollinations";

export const runtime = "nodejs";

interface ModelInfo { id: string; label?: string; kind: "image" | "video" | "text"; note?: string }

/** Lists models for a provider so the settings UI can offer real choices. */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  const kind = (req.nextUrl.searchParams.get("kind") || "image") as ModelInfo["kind"];
  const settings = withEnvFallbacks(parseSettingsHeader(req.headers.get("x-ligature-settings")));
  try {
    if (provider === "pollinations") {
      const path = kind === "text" ? "/text/models" : kind === "video" ? "/video/models" : "/image/models";
      const res = await fetchWithTimeout(`${POLLINATIONS_BASE}${path}`, { timeoutMs: 20_000 });
      if (!res.ok) throw new Error(`Pollinations ${res.status}`);
      const json = (await res.json()) as unknown;
      const list = Array.isArray(json) ? json : (json as { data?: unknown[] }).data ?? [];
      const models: ModelInfo[] = list
        .map((m) => {
          if (typeof m === "string") return { id: m, kind };
          const o = m as { id?: string; name?: string; description?: string; pricing?: unknown; output_modalities?: string[] };
          const id = o.id || o.name;
          if (!id) return null;
          if (kind === "image" && o.output_modalities && !o.output_modalities.includes("image")) return null;
          if (kind === "video" && o.output_modalities && !o.output_modalities.includes("video")) return null;
          return { id, label: o.description || id, kind };
        })
        .filter((m): m is ModelInfo => Boolean(m));
      return NextResponse.json({ models });
    }
    if (provider === "cloudflare") {
      const { accountId, apiToken } = settings.providers.cloudflare;
      if (!accountId || !apiToken) return NextResponse.json({ models: [], error: "Cloudflare not configured" });
      const task = kind === "text" ? "Text Generation" : "Text-to-Image";
      const res = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?task=${encodeURIComponent(task)}&per_page=100`, {
        headers: { Authorization: `Bearer ${apiToken}` },
        timeoutMs: 20_000,
      });
      const j = (await res.json()) as { result?: { name: string; description?: string }[] };
      return NextResponse.json({ models: (j.result ?? []).map((m) => ({ id: m.name, label: m.description || m.name, kind })) });
    }
    if (provider === "gemini") {
      const key = settings.providers.gemini.apiKey;
      if (!key) return NextResponse.json({ models: [], error: "Gemini not configured" });
      const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { timeoutMs: 20_000 });
      const j = (await res.json()) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
      const models = (j.models ?? [])
        .filter((m) => (kind === "image" ? /image/i.test(m.name) : !/image|embedding|tts|audio|imagen|veo/i.test(m.name)))
        .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName || m.name, kind }));
      return NextResponse.json({ models });
    }
    if (provider === "openai-compat") {
      const { baseUrl, apiKey } = settings.providers.openaiCompat;
      if (!baseUrl) return NextResponse.json({ models: [] });
      const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined, timeoutMs: 15_000 });
      const j = (await res.json()) as { data?: { id: string }[] };
      return NextResponse.json({ models: (j.data ?? []).map((m) => ({ id: m.id, label: m.id, kind: "text" })) });
    }
    return NextResponse.json({ models: [] });
  } catch (e) {
    return NextResponse.json({ models: [], error: e instanceof Error ? e.message : String(e) });
  }
}

import { NextResponse } from "next/server";
import fallback from "@/lib/type/fonts-fallback.json";
import { fetchWithTimeout } from "@/lib/providers/types";

export const runtime = "nodejs";

export interface FontMeta {
  id: string;
  family: string;
  category: "serif" | "sans-serif" | "display" | "handwriting" | "monospace" | "other";
  variable: boolean;
  weights: number[];
  subsets: string[];
}

const g = globalThis as unknown as { __ligatureFonts?: { at: number; fonts: FontMeta[]; source: string } };

function fromFallback(): FontMeta[] {
  return (fallback as [string, string, number, string[]?][]).map(([family, category, variable, subsets]) => ({
    id: family.toLowerCase().replace(/\s+/g, "-"),
    family,
    category: category as FontMeta["category"],
    variable: Boolean(variable),
    weights: [400, 700],
    subsets: subsets ?? ["latin"],
  }));
}

export async function GET() {
  if (g.__ligatureFonts && Date.now() - g.__ligatureFonts.at < 6 * 3600_000) {
    return NextResponse.json({ fonts: g.__ligatureFonts.fonts, source: g.__ligatureFonts.source }, { headers: { "Cache-Control": "public, max-age=3600" } });
  }
  try {
    const res = await fetchWithTimeout("https://api.fontsource.org/v1/fonts?type=google", { timeoutMs: 12_000 });
    if (!res.ok) throw new Error(`fontsource ${res.status}`);
    const list = (await res.json()) as { id: string; family: string; category: string; variable: boolean; weights: number[]; subsets: string[] }[];
    const fonts: FontMeta[] = list
      .filter((f) => f.subsets?.includes("latin") || f.subsets?.includes("arabic"))
      .map((f) => ({ id: f.id, family: f.family, category: (["serif", "sans-serif", "display", "handwriting", "monospace"].includes(f.category) ? f.category : "other") as FontMeta["category"], variable: Boolean(f.variable), weights: f.weights ?? [400], subsets: f.subsets ?? ["latin"] }));
    if (fonts.length < 50) throw new Error("fontsource returned too few fonts");
    g.__ligatureFonts = { at: Date.now(), fonts, source: "fontsource" };
    return NextResponse.json({ fonts, source: "fontsource" }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    const fonts = fromFallback();
    g.__ligatureFonts = { at: Date.now() - 5 * 3600_000, fonts, source: "bundled" };
    return NextResponse.json({ fonts, source: "bundled" }, { headers: { "Cache-Control": "public, max-age=600" } });
  }
}

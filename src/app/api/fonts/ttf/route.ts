import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/providers/types";

export const runtime = "nodejs";

/**
 * Returns a TrueType file for a Google Font so the browser can outline text
 * with opentype.js (Google only serves TTF to legacy user agents).
 */
export async function GET(req: NextRequest) {
  const family = req.nextUrl.searchParams.get("family")?.trim();
  const weight = req.nextUrl.searchParams.get("weight") || "400";
  const italic = req.nextUrl.searchParams.get("italic") === "1";
  if (!family) return NextResponse.json({ error: "family required" }, { status: 400 });
  const spec = `${encodeURIComponent(family).replace(/%20/g, "+")}:${weight}${italic ? "i" : ""}`;
  try {
    const css = await fetchWithTimeout(`https://fonts.googleapis.com/css?family=${spec}`, { headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" }, timeoutMs: 15_000 });
    if (!css.ok) return NextResponse.json({ error: `Google Fonts ${css.status}` }, { status: 502 });
    const text = await css.text();
    const url = /url\((https:[^)]+\.ttf)\)/.exec(text)?.[1];
    if (!url) return NextResponse.json({ error: "No TTF found for this family/weight" }, { status: 404 });
    const file = await fetchWithTimeout(url, { timeoutMs: 20_000 });
    if (!file.ok) return NextResponse.json({ error: `Font download ${file.status}` }, { status: 502 });
    return new NextResponse(await file.arrayBuffer(), { headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

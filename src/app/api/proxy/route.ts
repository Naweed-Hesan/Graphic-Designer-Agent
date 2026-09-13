import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/providers/types";

export const runtime = "nodejs";

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\]|::1)/i;

/** Fetches a remote image/video so the browser can draw it on a canvas (CORS). */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (!/^https?:$/.test(url.protocol) || PRIVATE.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) {
    return NextResponse.json({ error: "blocked" }, { status: 400 });
  }
  try {
    const res = await fetchWithTimeout(url.toString(), { timeoutMs: 30_000, headers: { "User-Agent": "Ligature/1.0" } });
    const ct = res.headers.get("content-type") || "application/octet-stream";
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    if (!/^(image|video|font)\//.test(ct) && !/octet-stream/.test(ct)) return NextResponse.json({ error: `unsupported type ${ct}` }, { status: 415 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 40 * 1024 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
    return new NextResponse(buf, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

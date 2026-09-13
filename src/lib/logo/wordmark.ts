"use client";
/**
 * Wordmark builder: live-text SVG (fast, font-dependent) or outlined paths via
 * opentype.js (exact, font-independent). Fonts are fetched as TTF through
 * /api/fonts/ttf and cached per family/weight.
 */

export type LetterCase = "none" | "uppercase" | "lowercase";

export interface WordmarkOptions {
  text: string;
  family: string;
  weight: number;
  /** Tracking in em (0.05 = 5% of the font size). */
  tracking: number;
  letterCase: LetterCase;
  color: string;
  /** Convert glyphs to <path> outlines (needs the TTF). */
  outline: boolean;
  /** Font size in SVG units (default 100). */
  size?: number;
  /** Fallback stack appended after the family in live-text mode. */
  fallback?: string;
}

export interface WordmarkResult {
  svg: string;
  width: number;
  height: number;
  /** True when glyphs were converted to paths. */
  outlined: boolean;
  /** Why outlining did not happen, if it was requested. */
  note?: string;
}

export function applyCase(text: string, letterCase: LetterCase): string {
  if (letterCase === "uppercase") return text.toUpperCase();
  if (letterCase === "lowercase") return text.toLowerCase();
  return text;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type OpentypeFont = import("opentype.js").Font;

const fontCache = new Map<string, Promise<OpentypeFont>>();

/** Fetch + parse a Google Font TTF (cached). Throws when offline or the family/weight is unavailable. */
export function loadOutlineFont(family: string, weight: number): Promise<OpentypeFont> {
  const key = `${family.trim().toLowerCase()}|${weight}`;
  let p = fontCache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(`/api/fonts/ttf?family=${encodeURIComponent(family.trim())}&weight=${weight}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `Font download failed (${res.status})`);
      }
      const buf = await res.arrayBuffer();
      const mod = await import("opentype.js");
      const parse = mod.parse ?? mod.default?.parse;
      if (!parse) throw new Error("opentype.js failed to load");
      return parse(buf);
    })();
    fontCache.set(key, p);
    p.catch(() => fontCache.delete(key));
  }
  return p;
}

/** Measure live text with the canvas API (falls back to a width estimate on the server). */
function measureText(text: string, family: string, weight: number, size: number, trackingPx: number, fallback: string): number {
  if (typeof document !== "undefined") {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `${weight} ${size}px "${family}", ${fallback}`;
      const base = ctx.measureText(text).width;
      return base + trackingPx * Math.max(0, text.length - 1);
    }
  }
  return text.length * size * 0.58 + trackingPx * Math.max(0, text.length - 1);
}

export function buildLiveTextWordmark(o: WordmarkOptions, note?: string): WordmarkResult {
  const size = o.size ?? 100;
  const text = applyCase(o.text, o.letterCase);
  const trackingPx = o.tracking * size;
  const fallback = o.fallback ?? "sans-serif";
  const pad = size * 0.06;
  const textW = measureText(text, o.family, o.weight, size, trackingPx, fallback);
  const width = r2(textW + pad * 2);
  const height = r2(size * 1.24);
  const baseline = r2(size * 0.94);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-live-text="true"><text x="${r2(pad)}" y="${baseline}" font-family="${escapeXml(o.family)}, ${escapeXml(fallback)}" font-size="${size}" font-weight="${o.weight}" letter-spacing="${r2(trackingPx)}" fill="${o.color}">${escapeXml(text)}</text></svg>`;
  return { svg, width, height, outlined: false, note };
}

export async function buildOutlinedWordmark(o: WordmarkOptions): Promise<WordmarkResult> {
  const size = o.size ?? 100;
  const text = applyCase(o.text, o.letterCase);
  const font = await loadOutlineFont(o.family, o.weight);
  const path = font.getPath(text, 0, 0, size, { kerning: true, letterSpacing: o.tracking });
  const bb = path.getBoundingBox();
  const pad = size * 0.06;
  const bw = Math.max(1, bb.x2 - bb.x1);
  const bh = Math.max(1, bb.y2 - bb.y1);
  const x = r2(bb.x1 - pad);
  const y = r2(bb.y1 - pad);
  const width = r2(bw + pad * 2);
  const height = r2(bh + pad * 2);
  const d = path.toPathData(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}"><path d="${d}" fill="${o.color}"/></svg>`;
  return { svg, width, height, outlined: true };
}

/**
 * Build a wordmark SVG. With `outline`, glyphs become <path> data (exact viewBox);
 * if the font cannot be fetched (offline, unknown family) it falls back to live
 * text and reports why in `note`.
 */
export async function buildWordmarkSvg(o: WordmarkOptions): Promise<WordmarkResult> {
  if (!o.text.trim()) return buildLiveTextWordmark({ ...o, text: "Wordmark" });
  if (o.outline) {
    try {
      return await buildOutlinedWordmark(o);
    } catch (e) {
      return buildLiveTextWordmark(o, `Outline unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return buildLiveTextWordmark(o, "Live text — glyphs depend on the viewer's fonts. Outline to paths for a font-independent SVG.");
}

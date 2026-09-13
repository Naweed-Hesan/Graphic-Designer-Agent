/**
 * Helpers around font metadata (from /api/fonts) and the Genome FontSpec.
 * Pure — no React, no DOM.
 */
import type { FontCategory, FontSpec } from "@/lib/genome/schema";

/** Structural version of the API's FontMeta so the lib doesn't depend on the route. */
export interface FontLike {
  id?: string;
  family: string;
  category: string;
  variable?: boolean;
  weights?: number[];
  subsets?: string[];
}

export const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

export const ALL_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function weightLabel(w: number): string {
  return WEIGHT_NAMES[w] ? `${w} ${WEIGHT_NAMES[w]}` : String(w);
}

export function toCategory(cat: string): FontCategory {
  return cat === "serif" || cat === "sans-serif" || cat === "display" || cat === "handwriting" || cat === "monospace" ? cat : "sans-serif";
}

export function fallbackFor(category: FontCategory): string {
  switch (category) {
    case "serif":
      return "serif";
    case "monospace":
      return "monospace";
    case "handwriting":
      return "cursive";
    default:
      return "sans-serif";
  }
}

export function hasArabic(meta: FontLike | undefined): boolean {
  return Boolean(meta?.subsets?.includes("arabic"));
}

/** Choose a compact, useful weight set from what the family offers. */
export function pickWeights(available: number[] | undefined, slot: "display" | "body" | "mono"): number[] {
  const avail = (available?.length ? [...new Set(available)] : [400, 700]).sort((a, b) => a - b);
  const want = slot === "body" ? [400, 500, 600, 700] : slot === "mono" ? [400, 700] : [400, 600, 700];
  const picked = want.filter((w) => avail.includes(w));
  if (picked.length >= 2) return picked;
  const nearest = (t: number) => [...avail].sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0];
  return [...new Set([nearest(400), nearest(700)])].sort((a, b) => a - b);
}

/** Convert API metadata into a Genome FontSpec for a slot. */
export function toFontSpec(meta: FontLike, slot: "display" | "body" | "mono"): FontSpec {
  const category = toCategory(meta.category);
  return {
    family: meta.family,
    source: "google",
    category,
    weights: pickWeights(meta.weights, slot),
    fallback: fallbackFor(category),
    variable: Boolean(meta.variable),
  };
}

export function findFont(fonts: FontLike[], family: string): FontLike | undefined {
  const f = family.trim().toLowerCase();
  return fonts.find((x) => x.family.toLowerCase() === f);
}

/** Simple ranked search over family names — prefix matches first, then substring. */
export function searchFonts<T extends FontLike>(fonts: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return fonts;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const f of fonts) {
    const fam = f.family.toLowerCase();
    if (fam.startsWith(q)) starts.push(f);
    else if (fam.includes(q)) contains.push(f);
  }
  return [...starts, ...contains];
}

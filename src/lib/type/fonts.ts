"use client";
/** Load Google Fonts on demand via the CSS2 API (no key needed). */
const loaded = new Set<string>();

export function googleFontUrl(family: string, weights: number[] = [400, 700], italic = false): string {
  const fam = family.trim().replace(/\s+/g, "+");
  const w = [...new Set(weights)].sort((a, b) => a - b);
  const axis = italic ? `ital,wght@${w.map((x) => `0,${x}`).join(";")};${w.map((x) => `1,${x}`).join(";")}` : `wght@${w.join(";")}`;
  return `https://fonts.googleapis.com/css2?family=${fam}:${axis}&display=swap`;
}

export function ensureFont(family: string, weights: number[] = [400, 700]): void {
  if (typeof document === "undefined" || !family) return;
  const key = `${family}|${weights.join(",")}`;
  if (loaded.has(key)) return;
  loaded.add(key);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = googleFontUrl(family, weights);
  link.dataset.ligatureFont = family;
  document.head.appendChild(link);
}

export function fontStack(family: string, fallback = "sans-serif"): string {
  return `"${family}", ${fallback}`;
}

/** Tiny colour helpers for procedural mockup rendering (pure, no DOM). */
import { hexToRgb, rgbToHex, relativeLuminance } from "@/lib/color/contrast";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Normalises any hex-ish string to #rrggbb; falls back when malformed. */
export function safeHex(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  const h = hex.trim();
  if (HEX6.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return ("#" + h.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
  return fallback;
}

/** Linear blend between two hex colours (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

export const lighten = (hex: string, amt: number) => mix(hex, "#ffffff", amt);
export const darken = (hex: string, amt: number) => mix(hex, "#000000", amt);

/** rgba() string from a hex colour. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

export function luminance(hex: string): number {
  return relativeLuminance(hex);
}

export const isDark = (hex: string) => relativeLuminance(hex) < 0.35;

/** Nudges saturation-free "tint" of a colour toward a neutral so surfaces look painted, not printed. */
export function tint(hex: string, toward: string, amt: number): string {
  return mix(hex, toward, amt);
}

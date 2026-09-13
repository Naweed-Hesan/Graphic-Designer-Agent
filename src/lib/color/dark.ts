/**
 * Dark-mode companions for a light palette. Backgrounds and text swap ends of
 * the lightness scale; chromatic colours are lifted so they still read on a
 * dark ground. Pure; the UI stores results in `palette.dark[colorId]`.
 */
import type { BrandColor } from "../genome/schema";
import { fromOklch, toOklch } from "./convert";
import { wcagRatio } from "./contrast";

export const DARK_GROUND = "#121417";

/** Propose a dark-mode hex for a colour, given the palette's dark background. */
export function suggestDarkVariant(color: Pick<BrandColor, "hex" | "role">, darkBackground = DARK_GROUND): string {
  const o = toOklch(color.hex);
  switch (color.role) {
    case "background":
      return fromOklch({ l: 0.17, c: Math.min(o.c, 0.02), h: o.h });
    case "surface":
      return fromOklch({ l: 0.22, c: Math.min(o.c, 0.02), h: o.h });
    case "text":
      return fromOklch({ l: 0.93, c: Math.min(o.c, 0.02), h: o.h });
    case "neutral":
      return fromOklch({ l: 0.32, c: Math.min(o.c, 0.03), h: o.h });
    default: {
      let l = o.l < 0.6 ? Math.max(o.l + 0.22, 0.68) : o.l;
      let hex = fromOklch({ l, c: o.c * 0.92, h: o.h });
      for (let i = 0; i < 8 && wcagRatio(hex, darkBackground) < 3; i++) {
        l += 0.04;
        hex = fromOklch({ l, c: o.c * 0.92, h: o.h });
      }
      return hex;
    }
  }
}

/** The palette as it would render in dark mode (overrides applied, others suggested). */
export function darkPalette(colors: BrandColor[], overrides: Record<string, string>): { id: string; hex: string; overridden: boolean }[] {
  const bg = colors.find((c) => c.role === "background");
  const darkBg = bg ? (overrides[bg.id] ?? suggestDarkVariant(bg)) : DARK_GROUND;
  return colors.map((c) => ({ id: c.id, hex: overrides[c.id] ?? suggestDarkVariant(c, darkBg), overridden: Boolean(overrides[c.id]) }));
}

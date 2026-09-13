/**
 * Colour conversion helpers built on culori. Everything perceptual happens in
 * OKLCH / OKLab so lightness and chroma stay even across hues. Pure, no React.
 */
import { converter, formatHex, clampChroma, type Oklch as CuloriOklch, type Oklab as CuloriOklab } from "culori";
import { hexToRgb, rgbToHex, wcagRatio } from "./contrast";

export interface Oklch {
  /** 0..1 */
  l: number;
  /** 0..~0.4 for sRGB */
  c: number;
  /** degrees 0..360 */
  h: number;
}
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const oklchOf = converter("oklch");
const oklabOf = converter("oklab");
const hslOf = converter("hsl");

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, d = 0) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

/** Accepts `#abc`, `abc`, `#AABBCC` … and returns `#aabbcc`, or null when invalid. */
export function normalizeHex(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith("#")) s = s.slice(1);
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/.test(s)) return null;
  return `#${s}`;
}

export function isHex(input: string): boolean {
  return normalizeHex(input) !== null;
}

export function toRgb(hex: string): Rgb {
  const [r, g, b] = hexToRgb(hex);
  return { r, g, b };
}

export function fromRgb({ r, g, b }: Rgb): string {
  return rgbToHex(r, g, b);
}

export function toHsl(hex: string): Hsl {
  const c = hslOf(hex);
  return { h: round(c?.h ?? 0), s: round((c?.s ?? 0) * 100), l: round((c?.l ?? 0) * 100) };
}

export function fromHsl({ h, s, l }: Hsl): string {
  return formatHex({ mode: "hsl", h, s: clamp(s, 0, 100) / 100, l: clamp(l, 0, 100) / 100 }) ?? "#000000";
}

export function toOklch(hex: string): Oklch {
  const c = oklchOf(hex);
  if (!c) return { l: 0, c: 0, h: 0 };
  return { l: c.l, c: c.c, h: Number.isFinite(c.h ?? NaN) ? (c.h as number) : 0 };
}

/** OKLCH → hex, gamut-mapped by reducing chroma until the colour fits sRGB. */
export function fromOklch({ l, c, h }: Oklch): string {
  const col: CuloriOklch = { mode: "oklch", l: clamp(l, 0, 1), c: Math.max(0, c), h: ((h % 360) + 360) % 360 };
  const inGamut = clampChroma(col, "oklch");
  return formatHex(inGamut) ?? "#000000";
}

/** Absolute overrides on OKLCH channels. */
export function withOklch(hex: string, patch: Partial<Oklch>): string {
  return fromOklch({ ...toOklch(hex), ...patch });
}

/** Relative shifts on OKLCH channels. */
export function shiftOklch(hex: string, delta: { dl?: number; dc?: number; dh?: number }): string {
  const o = toOklch(hex);
  return fromOklch({ l: o.l + (delta.dl ?? 0), c: o.c + (delta.dc ?? 0), h: o.h + (delta.dh ?? 0) });
}

/** Perceptual mix in OKLab. `t` = 0 → a, 1 → b. */
export function mix(a: string, b: string, t = 0.5): string {
  const A = oklabOf(a);
  const B = oklabOf(b);
  if (!A || !B) return a;
  const k = clamp(t, 0, 1);
  const lab: CuloriOklab = { mode: "oklab", l: A.l + (B.l - A.l) * k, a: A.a + (B.a - A.a) * k, b: A.b + (B.b - A.b) * k };
  return formatHex(clampChroma(lab, "oklch")) ?? a;
}

export function lighten(hex: string, amount = 0.1): string {
  return shiftOklch(hex, { dl: Math.abs(amount) });
}

export function darken(hex: string, amount = 0.1): string {
  return shiftOklch(hex, { dl: -Math.abs(amount) });
}

export function saturate(hex: string, amount = 0.04): string {
  return shiftOklch(hex, { dc: amount });
}

export function desaturate(hex: string, amount = 0.04): string {
  return shiftOklch(hex, { dc: -amount });
}

/** True when dark text reads better than light text on this colour. */
export function isLight(hex: string): boolean {
  return wcagRatio("#000000", hex) >= wcagRatio("#ffffff", hex);
}

export function lightness(hex: string): number {
  return toOklch(hex).l;
}

export function chroma(hex: string): number {
  return toOklch(hex).c;
}

export function hue(hex: string): number {
  return toOklch(hex).h;
}

/** Smallest angular distance between two hues, 0..180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** ΔE in OKLab (euclidean). ~0.02 is just noticeable; > 0.1 clearly different. */
export function deltaE(a: string, b: string): number {
  const A = oklabOf(a);
  const B = oklabOf(b);
  if (!A || !B) return 1;
  return Math.hypot(A.l - B.l, A.a - B.a, A.b - B.b);
}

/** Hue is "warm" when it sits in the red–yellow half of the OKLCH wheel. */
export function isWarmHue(h: number): boolean {
  const n = ((h % 360) + 360) % 360;
  return n < 120 || n >= 330;
}

export function oklchCss(hex: string): string {
  const o = toOklch(hex);
  return `oklch(${round(o.l * 100, 1)}% ${round(o.c, 3)} ${round(o.h, 1)})`;
}

export function rgbCss(hex: string): string {
  const { r, g, b } = toRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hslCss(hex: string): string {
  const { h, s, l } = toHsl(hex);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export interface ColorDescription {
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
}

export function describe(hex: string): ColorDescription {
  return { hex: hex.toUpperCase(), rgb: rgbCss(hex), hsl: hslCss(hex), oklch: oklchCss(hex) };
}

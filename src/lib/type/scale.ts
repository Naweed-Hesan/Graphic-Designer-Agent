/**
 * Modular type scales, fluid sizing and default text styles.
 * Pure, isomorphic — no React, no DOM.
 */
import type { Genome, TypeStyle } from "@/lib/genome/schema";
import { uid } from "@/lib/utils";

export interface RatioDef {
  id: string;
  name: string;
  value: number;
  note: string;
}

/** Named musical ratios, smallest to largest. */
export const RATIOS: RatioDef[] = [
  { id: "minor-second", name: "Minor second", value: 1.067, note: "Very tight — dense product UI and data tables" },
  { id: "major-second", name: "Major second", value: 1.125, note: "Subtle — apps and documentation" },
  { id: "minor-third", name: "Minor third", value: 1.2, note: "Balanced — marketing sites and dashboards" },
  { id: "major-third", name: "Major third", value: 1.25, note: "The classic web default" },
  { id: "perfect-fourth", name: "Perfect fourth", value: 1.333, note: "Confident hierarchy — editorial layouts" },
  { id: "augmented-fourth", name: "Augmented fourth", value: 1.414, note: "Dramatic — landing pages and posters" },
  { id: "perfect-fifth", name: "Perfect fifth", value: 1.5, note: "Bold — hero pages, few text sizes" },
  { id: "golden", name: "Golden ratio", value: 1.618, note: "Very expressive — display-led identities" },
];

/** Find the named ratio for a value (tolerance 0.001), or null when custom. */
export function ratioFor(value: number): RatioDef | null {
  return RATIOS.find((r) => Math.abs(r.value - value) < 0.001) ?? null;
}

export function ratioLabel(value: number): string {
  const r = ratioFor(value);
  return r ? `${r.name} (${r.value})` : `Custom (${value})`;
}

/** Step names, index 2 is the base size — matches the token exporters. */
export const STEP_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;
export type StepName = (typeof STEP_NAMES)[number];

export interface ScaleStep {
  name: string;
  /** Exponent relative to the base step */
  exp: number;
  px: number;
  rem: number;
}

export function stepPx(base: number, ratio: number, exp: number): number {
  return Math.round(base * Math.pow(ratio, exp) * 100) / 100;
}

export function pxToRem(px: number, root = 16): number {
  return Math.round((px / root) * 1000) / 1000;
}

/** Build a modular scale. `steps` are the step names; the one called "base" (or the third) is the base size. */
export function buildScale({ base, ratio, steps = STEP_NAMES }: { base: number; ratio: number; steps?: readonly string[] }): ScaleStep[] {
  const b = Number.isFinite(base) && base > 0 ? base : 16;
  const r = Number.isFinite(ratio) && ratio > 1 ? ratio : 1.25;
  const baseIndex = Math.max(0, steps.indexOf("base") >= 0 ? steps.indexOf("base") : Math.min(2, steps.length - 1));
  return steps.map((name, i) => {
    const exp = i - baseIndex;
    const px = stepPx(b, r, exp);
    return { name, exp, px, rem: pxToRem(px) };
  });
}

export function scaleMap(scale: { base: number; ratio: number }): Record<StepName, number> {
  const out = {} as Record<StepName, number>;
  for (const s of buildScale(scale)) out[s.name as StepName] = s.px;
  return out;
}

const fmt = (n: number, digits = 4) => {
  const v = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(v);
};

/**
 * CSS clamp() that interpolates linearly between `minPx` at `minVw` and `maxPx` at `maxVw`.
 * Output uses rem for the bounds so it respects user font-size preferences.
 */
export function fluidClamp(minPx: number, maxPx: number, minVw = 360, maxVw = 1440): string {
  if (!Number.isFinite(minPx) || !Number.isFinite(maxPx)) return `${fmt(pxToRem(minPx || 16), 3)}rem`;
  if (Math.abs(minPx - maxPx) < 0.01 || maxVw <= minVw) return `${fmt(pxToRem(minPx), 3)}rem`;
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  const preferred = `${fmt(pxToRem(intercept), 4)}rem + ${fmt(slope * 100, 4)}vw`;
  return `clamp(${fmt(pxToRem(lo), 3)}rem, ${preferred}, ${fmt(pxToRem(hi), 3)}rem)`;
}

export interface FluidStep extends ScaleStep {
  minPx: number;
  maxPx: number;
  clamp: string;
}

/**
 * A fluid version of the scale: at the small viewport the ratio is softened
 * (so large steps don't overwhelm a phone) and grows to the full ratio at the
 * large viewport. The base size is kept constant.
 */
export function fluidScale({ base, ratio, minVw = 360, maxVw = 1440, soften = 0.7 }: { base: number; ratio: number; minVw?: number; maxVw?: number; soften?: number }): FluidStep[] {
  const full = buildScale({ base, ratio });
  const minRatio = 1 + (ratio - 1) * soften;
  return full.map((s) => {
    const minPx = stepPx(base, minRatio, s.exp);
    return { ...s, minPx, maxPx: s.px, clamp: fluidClamp(minPx, s.px, minVw, maxVw) };
  });
}

/** Pick the available weight closest to `target` (ties resolve to the heavier weight). */
export function nearestWeight(weights: number[], target: number): number {
  if (!weights.length) return target;
  return [...weights].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a)[0];
}

/**
 * Ten sensible text styles sized from the scale. Line-heights tighten as size grows,
 * tracking tightens for large sans headlines and opens up for small caps.
 */
export function defaultTextStyles(genome: Genome, idFor: (index: number) => string = () => uid(8)): TypeStyle[] {
  const t = genome.visual.typography;
  const s = scaleMap(t.scale);
  const decorative = t.display.category === "display" || t.display.category === "handwriting";
  const sansDisplay = t.display.category === "sans-serif";
  const heavy = nearestWeight(t.display.weights, sansDisplay ? 700 : 600);
  const regular = nearestWeight(t.display.weights, 400);
  const bodyRegular = nearestWeight(t.body.weights, 400);
  const bodyMedium = nearestWeight(t.body.weights, 500);
  const bodySemibold = nearestWeight(t.body.weights, 600);
  const tight = sansDisplay ? -0.02 : -0.01;
  const px = (n: number) => Math.round(n);

  const rows: Omit<TypeStyle, "id">[] = [
    { name: "Display", font: "display", size: px(s["5xl"]), weight: heavy, lineHeight: 1, letterSpacing: tight - 0.01, transform: "none" },
    { name: "H1", font: "display", size: px(s["4xl"]), weight: heavy, lineHeight: 1.1, letterSpacing: tight, transform: "none" },
    { name: "H2", font: "display", size: px(s["3xl"]), weight: heavy, lineHeight: 1.15, letterSpacing: tight / 2, transform: "none" },
    { name: "H3", font: decorative ? "body" : "display", size: px(s["2xl"]), weight: decorative ? bodySemibold : regular, lineHeight: 1.25, letterSpacing: -0.005, transform: "none" },
    { name: "Subhead", font: "body", size: px(s.xl), weight: bodyMedium, lineHeight: 1.35, letterSpacing: 0, transform: "none" },
    { name: "Body", font: "body", size: px(s.base), weight: bodyRegular, lineHeight: 1.6, letterSpacing: 0, transform: "none" },
    { name: "Body small", font: "body", size: px(s.sm), weight: bodyRegular, lineHeight: 1.5, letterSpacing: 0, transform: "none" },
    { name: "Caption", font: "body", size: px(s.xs), weight: bodyRegular, lineHeight: 1.4, letterSpacing: 0.01, transform: "none" },
    { name: "Overline", font: "body", size: px(s.xs), weight: bodySemibold, lineHeight: 1.2, letterSpacing: 0.08, transform: "uppercase" },
    { name: "Button", font: "body", size: px(s.base), weight: bodySemibold, lineHeight: 1.2, letterSpacing: 0.01, transform: "none" },
  ];
  return rows.map((r, i) => ({ id: idFor(i), ...r }));
}

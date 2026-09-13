/**
 * Easing curves for the Motion lab. Pure and isomorphic — no DOM.
 *
 * `cubicBezier` mirrors the CSS timing function: the curve maps input time (x)
 * to output progress (y) and is solved with Newton–Raphson, falling back to
 * bisection when the slope gets too flat.
 */
import { parseCubicBezier } from "@/lib/export/tokens";

export type EasingFn = (t: number) => number;

export interface EasingPreset {
  id: string;
  name: string;
  css: string;
  description: string;
}

/** Id of the preset that resolves to `genome.visual.motion.easing`. */
export const BRAND_EASING_ID = "brand";
export const DEFAULT_EASING_CSS = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-6;
const PRECISION = 1e-6;
const BISECTION_ITERATIONS = 32;

export const clamp01 = (n: number) => (n <= 0 ? 0 : n >= 1 ? 1 : n);

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  if (x1 === y1 && x2 === y2) return clamp01; // straight line → linear
  const cx1 = Math.min(1, Math.max(0, x1));
  const cx2 = Math.min(1, Math.max(0, x2));

  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const bezier = (u: number, p1: number, p2: number) => ((a(p1, p2) * u + b(p1, p2)) * u + c(p1)) * u;
  const slope = (u: number, p1: number, p2: number) => 3 * a(p1, p2) * u * u + 2 * b(p1, p2) * u + c(p1);

  const solve = (x: number): number => {
    let u = x;
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const s = slope(u, cx1, cx2);
      if (Math.abs(s) < NEWTON_MIN_SLOPE) break;
      const err = bezier(u, cx1, cx2) - x;
      if (Math.abs(err) < PRECISION) return u;
      u -= err / s;
    }
    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < BISECTION_ITERATIONS; i++) {
      const bx = bezier(u, cx1, cx2);
      if (Math.abs(bx - x) < PRECISION) return u;
      if (x > bx) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return u;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return bezier(solve(t), y1, y2);
  };
}

export const EASING_PRESETS: EasingPreset[] = [
  { id: BRAND_EASING_ID, name: "Brand default", css: DEFAULT_EASING_CSS, description: "Brand default from the Genome (visual.motion.easing)" },
  { id: "ease-out-soft", name: "Ease-out soft", css: DEFAULT_EASING_CSS, description: "Gentle deceleration — the studio default" },
  { id: "ease-out-expo", name: "Ease-out expo", css: "cubic-bezier(0.16, 1, 0.3, 1)", description: "Arrives fast, settles for a long time — the premium default" },
  { id: "ease-out-quart", name: "Ease-out quart", css: "cubic-bezier(0.25, 1, 0.5, 1)", description: "Confident deceleration without drama" },
  { id: "ease-in-out", name: "Ease-in-out", css: "cubic-bezier(0.65, 0, 0.35, 1)", description: "Symmetric: gentle start, gentle finish" },
  { id: "linear", name: "Linear", css: "linear", description: "Constant speed — mechanical, good for wipes and draw-ons" },
  { id: "anticipate", name: "Anticipate", css: "cubic-bezier(0.5, -0.25, 0.2, 1)", description: "Pulls back a touch before committing" },
  { id: "overshoot", name: "Soft overshoot", css: "cubic-bezier(0.34, 1.3, 0.64, 1)", description: "Lands just past the mark and settles — playful" },
];

const KEYWORDS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** True when the string is something `easeFromCss` understands. */
export function isValidEasingCss(css: string): boolean {
  const s = css.trim().toLowerCase();
  if (s === "linear" || s in KEYWORDS) return true;
  if (/^steps\(\s*\d+\s*(,\s*(start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/.test(s)) return true;
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(s);
  if (!m) return false;
  const nums = m[1].split(",").map((x) => parseFloat(x.trim()));
  return nums.length === 4 && nums.every((n) => Number.isFinite(n)) && nums[0] >= 0 && nums[0] <= 1 && nums[2] >= 0 && nums[2] <= 1;
}

/** Parses a CSS timing function (`cubic-bezier(…)`, keywords, `steps(n)`) into a function of t∈[0,1]. */
export function easeFromCss(css: string): EasingFn {
  const s = (css || "").trim().toLowerCase();
  if (s === "linear") return clamp01;
  if (s in KEYWORDS) return cubicBezier(...KEYWORDS[s]);
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*([a-z-]+)\s*)?\)$/.exec(s);
  if (steps) {
    const n = Math.max(1, parseInt(steps[1], 10));
    const start = steps[2] === "start" || steps[2] === "jump-start";
    return (t) => clamp01((start ? Math.ceil(clamp01(t) * n) : Math.floor(clamp01(t) * n)) / n);
  }
  if (s.startsWith("cubic-bezier(")) return cubicBezier(...parseCubicBezier(s));
  return cubicBezier(...parseCubicBezier(DEFAULT_EASING_CSS));
}

/** Resolves a preset id (or raw css) to the css string, substituting the Genome easing for the brand preset. */
export function resolveEasingCss(idOrCss: string, brandCss: string): string {
  if (idOrCss === BRAND_EASING_ID) return brandCss || DEFAULT_EASING_CSS;
  const preset = EASING_PRESETS.find((p) => p.id === idOrCss);
  return preset ? preset.css : idOrCss;
}

/** Samples the curve into an SVG path (for tiny curve previews). */
export function easingToPath(ease: EasingFn, width = 64, height = 48, samples = 48): string {
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = ease(t);
    pts.push(`${i === 0 ? "M" : "L"}${(t * width).toFixed(2)} ${(height - y * height).toFixed(2)}`);
  }
  return pts.join(" ");
}

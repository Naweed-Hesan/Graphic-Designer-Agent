/**
 * Tint/shade ramps (50…950) with fixed OKLCH lightness targets. Hue is kept,
 * chroma follows a bell curve so mid-tones don't blow out and the extremes
 * stay clean. The step nearest the seed's own lightness is the seed itself.
 */
import { fromOklch, toOklch } from "./convert";

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

export const RAMP_LIGHTNESS: Record<RampStep, number> = {
  50: 0.975,
  100: 0.945,
  200: 0.89,
  300: 0.815,
  400: 0.73,
  500: 0.64,
  600: 0.55,
  700: 0.46,
  800: 0.38,
  900: 0.3,
  950: 0.22,
};

export interface RampEntry {
  step: RampStep;
  hex: string;
  /** OKLCH lightness target */
  l: number;
  /** True for the step that is the seed colour itself */
  isSeed: boolean;
}

/** Chroma headroom as a function of lightness: peaks around L≈0.62, falls off toward black/white. */
function chromaBell(l: number): number {
  return Math.max(0.04, 1 - Math.pow((l - 0.62) / 0.5, 2));
}

export function ramp(hex: string): RampEntry[] {
  const seed = toOklch(hex);
  const seedBell = chromaBell(seed.l);
  let nearest: RampStep = 500;
  let nearestD = Infinity;
  for (const step of RAMP_STEPS) {
    const d = Math.abs(RAMP_LIGHTNESS[step] - seed.l);
    if (d < nearestD) {
      nearestD = d;
      nearest = step;
    }
  }
  return RAMP_STEPS.map((step) => {
    const l = RAMP_LIGHTNESS[step];
    if (step === nearest) return { step, hex: hex.toLowerCase(), l: seed.l, isSeed: true };
    const c = Math.min(seed.c * 1.15, (seed.c * chromaBell(l)) / seedBell);
    return { step, hex: fromOklch({ l, c, h: seed.h }), l, isSeed: false };
  });
}

/** CSS custom properties for a ramp: `--color-teal-50: #…;` */
export function rampCss(name: string, hex: string, prefix = "color"): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "color";
  return ramp(hex)
    .map((r) => `--${prefix}-${slug}-${r.step}: ${r.hex};`)
    .join("\n");
}

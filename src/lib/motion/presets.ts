/**
 * Logo-animation presets. Each preset is a pure function of normalised time
 * t∈[0,1] returning per-frame directives that `applyDirectivesToSvg` turns
 * into SVG transforms, clips, masks and filters. No DOM here.
 */
import { clamp01, type EasingFn } from "./easing";

export type MotionTag = "calm" | "energetic" | "premium" | "playful";

export interface PartDirectives {
  opacity?: number;
  scale?: number;
  /** Fractions of the logo viewBox width / height */
  translate?: { x: number; y: number };
  rotate?: number;
}

export interface EmberDirective {
  /** Centre as fractions of the logo viewBox (0..1; may exceed the box) */
  x: number;
  y: number;
  /** Radius as a fraction of the viewBox width */
  r: number;
  opacity: number;
  color?: string;
  /** 0 = hard dot, 1 = pure glow */
  soft?: number;
}

export interface FrameDirectives {
  /** Whole-logo opacity 0..1 */
  opacity?: number;
  /** Uniform scale about the logo centre */
  scale?: number;
  /** Fractions of the viewBox width / height */
  translate?: { x: number; y: number };
  /** Degrees, clockwise, about the centre */
  rotate?: number;
  /** Gaussian blur radius as a fraction of the viewBox width */
  blur?: number;
  /** Rectangular clip in fractions of the viewBox (static in canvas space) */
  clip?: { x: number; y: number; w: number; h: number };
  /** Circular mask; r is a fraction of the half-diagonal (1 = fully revealed) */
  iris?: { r: number; cx?: number; cy?: number };
  /** Stroke-dash draw-on: progress of the stroke, then fill opacity */
  draw?: { progress: number; fill: number; strokeWidth?: number; stagger?: number };
  /** Per top-level child directives, in document order */
  parts?: PartDirectives[];
  /** Two halves offset in opposite directions (fraction of the viewBox size) */
  split?: { axis: "x" | "y"; offset: number };
  /** Soft coloured halo behind the logo shapes */
  glow?: { radius: number; opacity: number; color?: string };
  /** Multiplies the canvas background opacity (background fade) */
  background?: { opacity: number };
  /** Accent "ember" overlay */
  ember?: EmberDirective;
}

export interface MotionContext {
  ease: EasingFn;
  easingCss: string;
  /** Animation duration in seconds (hold excluded) */
  duration: number;
  /** Number of top-level renderable children in the logo SVG */
  partCount: number;
  primary: string;
  accent: string;
}

export interface MotionPreset {
  id: string;
  name: string;
  description: string;
  tags: MotionTag[];
  /** Default duration expressed as a multiple of `genome.visual.motion.durationBase` */
  durationMultiplier: number;
  /** CSS keyframes body used by the motion-tokens code block */
  cssKeyframes: string;
  /** Extra guidance for the CSS translation */
  cssHint?: string;
  frame: (t: number, ctx: MotionContext) => FrameDirectives;
}

export const DEFAULT_PRESET_ID = "reveal-scale";
export const MIN_DURATION = 0.5;
export const MAX_DURATION = 6;

/** Progress of the sub-segment [start, end] of t, clamped to 0..1. */
export const seg = (t: number, start: number, end: number) => (end <= start ? (t >= end ? 1 : 0) : clamp01((t - start) / (end - start)));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Default duration for a preset given the Genome's base duration (ms), clamped to the lab's range. */
export function presetDuration(preset: MotionPreset, durationBaseMs: number): number {
  const base = Number.isFinite(durationBaseMs) && durationBaseMs > 0 ? durationBaseMs : 400;
  const s = (base / 1000) * preset.durationMultiplier;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(s * 10) / 10));
}

/** Accent ember that arrives last — used by the "Ember accent" toggle and by presets that call it. */
export function emberAt(t: number, ctx: MotionContext, start = 0.55): EmberDirective | undefined {
  const p = ctx.ease(seg(t, start, 1));
  if (p <= 0) return undefined;
  return {
    x: lerp(0.62, 1.03, p),
    y: lerp(0.92, -0.03, p),
    r: 0.032 * (0.6 + 0.4 * p),
    opacity: Math.min(1, p * 3),
    color: ctx.accent,
    soft: 0.4,
  };
}

const fadeUp = (t: number, ctx: MotionContext, lift = 0.12): FrameDirectives => {
  const e = ctx.ease(t);
  return { opacity: e, translate: { x: 0, y: (1 - e) * lift } };
};

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "reveal-scale",
    name: "Reveal · scale",
    description: "Fades in while settling from 92% to full size. The quiet default.",
    tags: ["calm", "premium"],
    durationMultiplier: 2,
    cssKeyframes: "from { opacity: 0; transform: scale(0.92); }\n  to   { opacity: 1; transform: none; }",
    frame: (t, ctx) => {
      const e = ctx.ease(t);
      return { opacity: e, scale: lerp(0.92, 1, e) };
    },
  },
  {
    id: "draw-on",
    name: "Draw-on",
    description: "Every path is stroked on like a pen, then the fills bloom in.",
    tags: ["premium", "calm"],
    durationMultiplier: 4,
    cssKeyframes: "from { stroke-dashoffset: 1; fill-opacity: 0; }\n  70%  { stroke-dashoffset: 0; fill-opacity: 0; }\n  to   { stroke-dashoffset: 0; fill-opacity: 1; }",
    cssHint: 'Add pathLength="1" and stroke-dasharray="1" to each path so the offsets are unit-based.',
    frame: (t, ctx) => {
      const progress = ctx.ease(seg(t, 0, 0.72));
      const fill = ctx.ease(seg(t, 0.58, 1));
      return { draw: { progress, fill, stagger: 0.35 }, opacity: seg(t, 0, 0.08) };
    },
  },
  {
    id: "fade-up",
    name: "Fade up",
    description: "Rises a short distance into place while fading in.",
    tags: ["calm"],
    durationMultiplier: 2,
    cssKeyframes: "from { opacity: 0; transform: translateY(12%); }\n  to   { opacity: 1; transform: none; }",
    frame: (t, ctx) => fadeUp(t, ctx),
  },
  {
    id: "wipe-left",
    name: "Wipe left",
    description: "A hard edge sweeps leftwards to uncover the mark as it slides into place.",
    tags: ["energetic"],
    durationMultiplier: 1.6,
    cssKeyframes: "from { clip-path: inset(0 0 0 100%); transform: translateX(4%); }\n  to   { clip-path: inset(0); transform: none; }",
    frame: (t, ctx) => {
      const e = ctx.ease(t);
      return { clip: { x: 1 - e, y: -0.05, w: e + 0.05, h: 1.1 }, translate: { x: (1 - e) * 0.04, y: 0 } };
    },
  },
  {
    id: "mask-circle",
    name: "Iris",
    description: "A circular mask opens from the centre — a lens iris.",
    tags: ["premium", "playful"],
    durationMultiplier: 2.2,
    cssKeyframes: "from { clip-path: circle(0% at 50% 50%); transform: scale(0.96); }\n  to   { clip-path: circle(75% at 50% 50%); transform: none; }",
    frame: (t, ctx) => {
      const e = ctx.ease(t);
      return { iris: { r: e }, scale: lerp(0.96, 1, e) };
    },
  },
  {
    id: "parts-stagger",
    name: "Parts stagger",
    description: "Each top-level element of the logo rises in sequence — letters, shapes, lockup pieces.",
    tags: ["energetic", "playful"],
    durationMultiplier: 3,
    cssKeyframes: "from { opacity: 0; transform: translateY(15%); }\n  to   { opacity: 1; transform: none; }",
    cssHint: "Apply to each child with animation-delay: calc(var(--i) * 80ms).",
    frame: (t, ctx) => {
      const n = Math.max(1, ctx.partCount);
      if (n === 1) return fadeUp(t, ctx, 0.15);
      const gap = Math.min(0.12, 0.6 / n);
      const span = 1 - gap * (n - 1);
      const parts: PartDirectives[] = [];
      for (let i = 0; i < n; i++) {
        const e = ctx.ease(clamp01((t - i * gap) / span));
        parts.push({ opacity: e, translate: { x: 0, y: (1 - e) * 0.15 } });
      }
      return { parts };
    },
  },
  {
    id: "pulse-once",
    name: "Pulse once",
    description: "Fades in, then a single soft pulse and an accent glow that fades away.",
    tags: ["playful", "energetic"],
    durationMultiplier: 2.6,
    cssKeyframes: "0%   { opacity: 0; }\n  40%  { opacity: 1; transform: none; filter: none; }\n  70%  { transform: scale(1.04); filter: drop-shadow(0 0 24px var(--brand-accent)); }\n  100% { transform: none; filter: none; }",
    frame: (t, ctx) => {
      const e = ctx.ease(seg(t, 0, 0.4));
      const pulse = Math.sin(Math.PI * seg(t, 0.35, 0.95));
      return {
        opacity: e,
        scale: lerp(0.97, 1, e) + 0.04 * pulse,
        glow: { radius: 0.05 + 0.04 * pulse, opacity: 0.65 * pulse, color: ctx.accent },
        ember: emberAt(t, ctx, 0.45),
      };
    },
  },
  {
    id: "split-join",
    name: "Split · join",
    description: "The two halves of the mark slide in from opposite sides and meet.",
    tags: ["energetic", "premium"],
    durationMultiplier: 2,
    cssKeyframes: "from { opacity: 0; transform: translateX(-25%); }\n  to   { opacity: 1; transform: none; }",
    cssHint: "Render two copies clipped to each half; mirror the translate for the right half.",
    frame: (t, ctx) => {
      const e = ctx.ease(t);
      return { split: { axis: "x", offset: (1 - e) * 0.25 }, opacity: ctx.ease(seg(t, 0, 0.5)) };
    },
  },
  {
    id: "rotate-in",
    name: "Rotate in",
    description: "Swings in from a slight tilt while scaling up.",
    tags: ["playful", "energetic"],
    durationMultiplier: 2,
    cssKeyframes: "from { opacity: 0; transform: rotate(-12deg) scale(0.85); }\n  to   { opacity: 1; transform: none; }",
    frame: (t, ctx) => {
      const e = ctx.ease(t);
      return { rotate: (1 - e) * -12, scale: lerp(0.85, 1, e), opacity: ctx.ease(seg(t, 0, 0.6)) };
    },
  },
  {
    id: "blur-in",
    name: "Blur in",
    description: "Resolves from a soft blur into sharp focus, like a lens pulling focus.",
    tags: ["premium", "calm"],
    durationMultiplier: 2.4,
    cssKeyframes: "from { opacity: 0; filter: blur(12px); transform: scale(1.04); }\n  to   { opacity: 1; filter: blur(0); transform: none; }",
    frame: (t, ctx) => {
      const e = ctx.ease(t);
      return { blur: (1 - e) * 0.04, opacity: ctx.ease(seg(t, 0, 0.7)), scale: lerp(1.04, 1, e) };
    },
  },
];

export const PRESET_BY_ID = Object.fromEntries(MOTION_PRESETS.map((p) => [p.id, p])) as Record<string, MotionPreset>;

export function getPreset(id: string | undefined | null): MotionPreset {
  return (id && PRESET_BY_ID[id]) || PRESET_BY_ID[DEFAULT_PRESET_ID];
}

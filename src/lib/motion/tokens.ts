/** Motion tokens (CSS) and prompt helpers derived from the Genome. Pure. */
import type { Genome } from "@/lib/genome/schema";
import { DEFAULT_EASING_CSS } from "./easing";
import { getPreset, presetDuration, type MotionPreset } from "./presets";

export const PRINCIPLE_SUGGESTIONS = [
  "Ease out, never bounce",
  "Enter fast, exit faster",
  "Motion follows the mark's geometry",
  "One accent moves last",
  "Nothing moves without a reason",
  "Respect prefers-reduced-motion",
  "Small elements move quicker than large ones",
  "Fade before you slide",
];

const round = (n: number) => Math.round(n);

/** CSS custom properties + a keyframes example for the chosen preset. */
export function motionTokensCss(genome: Genome, preset: MotionPreset = getPreset(genome.visual.motion.preset), opts: { duration?: number; prefix?: string } = {}): string {
  const m = genome.visual.motion;
  const prefix = opts.prefix ?? "motion";
  const easing = m.easing || DEFAULT_EASING_CSS;
  const base = m.durationBase || 400;
  const reveal = opts.duration ?? presetDuration(preset, base);
  const accent = genome.visual.palette.colors.find((c) => c.role === "accent")?.hex ?? genome.visual.palette.colors.find((c) => c.role === "primary")?.hex ?? "#000000";
  const principles = m.principles.length ? m.principles.map((p) => ` * - ${p}`).join("\n") : " * - (no principles yet)";
  const lines = [
    `/* ${genome.name} — motion tokens`,
    ` * Preset: ${preset.name} (${preset.id})`,
    principles,
    ` */`,
    `:root {`,
    `  --${prefix}-ease-brand: ${easing};`,
    `  --${prefix}-ease-linear: linear;`,
    `  --${prefix}-duration-instant: ${round(base * 0.25)}ms;`,
    `  --${prefix}-duration-fast: ${round(base * 0.5)}ms;`,
    `  --${prefix}-duration-base: ${round(base)}ms;`,
    `  --${prefix}-duration-slow: ${round(base * 1.5)}ms;`,
    `  --${prefix}-duration-reveal: ${round(reveal * 1000)}ms;`,
    `  --${prefix}-stagger: ${round(Math.min(120, Math.max(40, base * 0.15)))}ms;`,
    `  --brand-accent: ${accent.toLowerCase()};`,
    `}`,
    ``,
    `@keyframes brand-${preset.id} {`,
    `  ${preset.cssKeyframes}`,
    `}`,
    ``,
    `.brand-logo {`,
    `  animation: brand-${preset.id} var(--${prefix}-duration-reveal) var(--${prefix}-ease-brand) both;`,
    `}`,
  ];
  if (preset.cssHint) lines.push(`/* ${preset.cssHint} */`);
  lines.push(``, `@media (prefers-reduced-motion: reduce) {`, `  .brand-logo { animation: none; }`, `}`, ``);
  return lines.join("\n");
}

/** Short motion vocabulary for video prompts, derived from the principles and easing. */
export function motionWords(genome: Genome): string {
  const m = genome.visual.motion;
  const parts: string[] = [];
  if (m.principles.length) parts.push(m.principles.slice(0, 4).join("; ").toLowerCase());
  const eased = m.easing.toLowerCase();
  if (eased === "linear") parts.push("constant, mechanical pacing");
  else if (/-0\.|,\s*1\.[2-9]/.test(eased)) parts.push("a touch of anticipation and settle");
  else parts.push("eased, decelerating movement that settles gently");
  const base = m.durationBase || 400;
  parts.push(base >= 600 ? "slow, unhurried camera" : base <= 250 ? "brisk, snappy camera" : "measured camera pace");
  parts.push("no strobing, no fast cuts, no text");
  return parts.join(", ");
}

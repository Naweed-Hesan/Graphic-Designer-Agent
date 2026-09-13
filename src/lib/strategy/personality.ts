/**
 * Personality axes: readout sentence and radar geometry. Pure, no React.
 */
import type { PersonalityAxis } from "@/lib/genome/schema";
import { PERSONALITY_AXES } from "@/lib/genome/archetypes";

/** Fall back to the default six axes (all centred) when the genome has none. */
export function ensureAxes(axes: PersonalityAxis[]): PersonalityAxis[] {
  if (axes.length) return axes;
  return PERSONALITY_AXES.map((a) => ({ ...a, value: 50 }));
}

export function sameAxes(a: PersonalityAxis[], b: PersonalityAxis[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x.id === b[i].id && x.value === b[i].value);
}

export type Lean = "left" | "right" | "centre";

export interface AxisReading {
  id: string;
  /** The pole word the value leans toward, lower-cased; "balanced" at the centre */
  word: string;
  lean: Lean;
  /** 0 balanced · 1 leaning · 2 committed */
  strength: 0 | 1 | 2;
  /** Distance from the centre, 0–50 */
  distance: number;
}

export function readAxis(a: PersonalityAxis): AxisReading {
  const delta = a.value - 50;
  const distance = Math.abs(delta);
  const lean: Lean = distance < 12 ? "centre" : delta < 0 ? "left" : "right";
  const pole = (lean === "left" ? a.left : a.right).toLowerCase();
  const strength: 0 | 1 | 2 = distance < 12 ? 0 : distance < 30 ? 1 : 2;
  return { id: a.id, word: strength === 0 ? "balanced" : pole, lean, strength, distance };
}

/** "Serious, premium, calm, fairly modern." — strongest traits first. */
export function personalityReadout(axes: PersonalityAxis[]): string {
  const readings = ensureAxes(axes)
    .map(readAxis)
    .filter((r) => r.strength > 0)
    .sort((a, b) => b.distance - a.distance);
  if (!readings.length) return "Balanced on every axis — nudge a slider to give the brand a stance.";
  const words = readings.map((r) => (r.strength === 2 ? r.word : `fairly ${r.word}`));
  const sentence = words.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

export interface RadarPoint {
  x: number;
  y: number;
}

/** Points of a regular polygon with `n` spokes, starting at 12 o'clock. */
export function radarPoints(values: number[], cx: number, cy: number, radius: number): RadarPoint[] {
  const n = values.length;
  return values.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

export function pointsAttr(points: RadarPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/** Anchor for a spoke label so text never overlaps the chart. */
export function labelAnchor(index: number, count: number): "start" | "middle" | "end" {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const c = Math.cos(angle);
  if (Math.abs(c) < 0.15) return "middle";
  return c > 0 ? "start" : "end";
}

"use client";
/** Shared types, constants and small pure helpers for the Motion lab UI. */
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { getLogoVariants, paletteColor, placeholderMarkSvg } from "@/lib/logo/assets";
import { BRAND_EASING_ID } from "@/lib/motion/easing";
import { getPreset, presetDuration } from "@/lib/motion/presets";

export type AspectId = "1:1" | "16:9" | "9:16" | "4:5";

export interface AspectDef {
  id: AspectId;
  label: string;
  w: number;
  h: number;
  /** Long-edge pixels suggested when this aspect is picked */
  defaultResolution: number;
}

export const ASPECTS: AspectDef[] = [
  { id: "1:1", label: "Square · 1:1", w: 1, h: 1, defaultResolution: 1080 },
  { id: "16:9", label: "Wide · 16:9", w: 16, h: 9, defaultResolution: 1920 },
  { id: "9:16", label: "Tall · 9:16", w: 9, h: 16, defaultResolution: 1920 },
  { id: "4:5", label: "Portrait · 4:5", w: 4, h: 5, defaultResolution: 1350 },
];
export const ASPECT_BY_ID = Object.fromEntries(ASPECTS.map((a) => [a.id, a])) as Record<AspectId, AspectDef>;

/** Long-edge pixel options */
export const RESOLUTIONS = [480, 720, 1080, 1350, 1440, 1920, 2160];
export const FPS_OPTIONS = [24, 30, 60] as const;
export type Fps = (typeof FPS_OPTIONS)[number];

/** Even-numbered output size for an aspect and a long-edge resolution. */
export function outputSize(aspectId: AspectId, resolution: number): { width: number; height: number } {
  const a = ASPECT_BY_ID[aspectId] ?? ASPECTS[0];
  const long = Math.max(16, Math.round(resolution / 2) * 2);
  const short = Math.max(16, Math.round((long * Math.min(a.w, a.h)) / Math.max(a.w, a.h) / 2) * 2);
  return a.w >= a.h ? { width: long, height: short } : { width: short, height: long };
}

export interface LogoAnimSettings {
  sourceKey: string;
  /** Seconds, hold excluded */
  duration: number;
  /** Easing preset id or "custom" */
  easingId: string;
  customEasing: string;
  fps: Fps;
  aspectId: AspectId;
  resolution: number;
  /** Hex colour or "transparent" */
  background: string;
  /** Fraction of the shorter edge (0..0.4) */
  padding: number;
  /** Seconds to hold the final frame */
  hold: number;
  ember: boolean;
}

export interface LogoSource {
  key: string;
  label: string;
  svg: string;
  placeholder: boolean;
  assetId?: string;
}

const VARIANT_LABELS: Record<string, string> = {
  primary: "Primary",
  mark: "Mark",
  wordmark: "Wordmark",
  horizontal: "Horizontal",
  stacked: "Stacked",
  "mono-dark": "Mono · dark",
  "mono-light": "Mono · light",
  favicon: "Favicon",
};

/** Every logo artwork in the project, then any SVG asset, then the generated placeholder. */
export function logoSources(genome: Genome, assets: Asset[]): LogoSource[] {
  const out: LogoSource[] = [];
  const seen = new Set<string>();
  const variants = getLogoVariants(genome, assets);
  const order = ["primary", "horizontal", "stacked", "mark", "wordmark", "mono-dark", "mono-light", "favicon"];
  for (const key of order) {
    const art = variants[key as keyof typeof variants];
    if (!art || (art.assetId && seen.has(art.assetId))) continue;
    if (art.assetId) seen.add(art.assetId);
    out.push({ key: `variant:${key}`, label: VARIANT_LABELS[key] ?? key, svg: art.svg, placeholder: false, assetId: art.assetId });
  }
  for (const a of assets) {
    if (a.kind !== "svg" || !a.svg || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push({ key: `asset:${a.id}`, label: a.name, svg: a.svg, placeholder: false, assetId: a.id });
  }
  out.push({ key: "placeholder", label: "Generated placeholder", svg: placeholderMarkSvg(genome), placeholder: true });
  return out;
}

export function brandColors(genome: Genome): { primary: string; accent: string } {
  const primary = paletteColor(genome, "primary", "#1f1f1f");
  return { primary, accent: paletteColor(genome, "accent", primary) };
}

export function defaultBackground(genome: Genome): string {
  return paletteColor(genome, "background", "#ffffff");
}

export function initialSettings(genome: Genome, assets: Asset[]): LogoAnimSettings {
  const preset = getPreset(genome.visual.motion.preset);
  const sources = logoSources(genome, assets);
  return {
    sourceKey: sources[0]?.key ?? "placeholder",
    duration: presetDuration(preset, genome.visual.motion.durationBase),
    easingId: BRAND_EASING_ID,
    customEasing: genome.visual.motion.easing,
    fps: 30,
    aspectId: "1:1",
    resolution: 1080,
    background: defaultBackground(genome),
    padding: 0.14,
    hold: 0.8,
    ember: false,
  };
}

export function extForMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("zip")) return "zip";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg")) return "jpg";
  return "bin";
}

/**
 * Harmony and brand-aware palette generation. Everything is computed in
 * OKLCH so hue rotations keep perceived lightness even. Deterministic: the
 * same inputs (plus `seed`) always produce the same palette.
 */
import type { Archetype, BrandColor, ColorRole, PersonalityAxis } from "../genome/schema";
import { fromOklch, hueDistance, normalizeHex, toOklch } from "./convert";
import { wcagRatio } from "./contrast";
import { nameColors } from "./names";

export type HarmonyScheme = "complementary" | "analogous" | "triadic" | "split-complementary" | "tetradic" | "monochromatic" | "brand";

export const HARMONY_SCHEMES: { id: HarmonyScheme; label: string; description: string }[] = [
  { id: "brand", label: "Brand-aware", description: "Roles chosen from the Genome's personality axes and archetype." },
  { id: "complementary", label: "Complementary", description: "The seed and its opposite — maximum tension." },
  { id: "analogous", label: "Analogous", description: "Neighbouring hues — calm and cohesive." },
  { id: "triadic", label: "Triadic", description: "Three hues 120° apart — lively but balanced." },
  { id: "split-complementary", label: "Split complementary", description: "The seed plus the two hues beside its opposite." },
  { id: "tetradic", label: "Tetradic", description: "Two complementary pairs — rich, needs one dominant." },
  { id: "monochromatic", label: "Monochromatic", description: "One hue across lightness — quiet and tonal." },
];

/** A role-assigned colour proposal; the UI turns it into a BrandColor. */
export interface PaletteSuggestion {
  name: string;
  hex: string;
  role: ColorRole;
  usage: string;
}

export type BrandRole = "primary" | "secondary" | "accent" | "neutral" | "background" | "text";
export const BRAND_ROLES: BrandRole[] = ["primary", "secondary", "accent", "neutral", "background", "text"];

export const ROLE_USAGE: Record<BrandRole, string> = {
  primary: "Logo, headlines, primary actions",
  secondary: "Supporting surfaces, packaging, dark sections",
  accent: "Highlights, calls to action, small emphasis",
  neutral: "Tints, dividers, secondary surfaces",
  background: "Page and paper backgrounds",
  text: "Body copy and UI text",
};

const HUE_OFFSETS: Record<Exclude<HarmonyScheme, "monochromatic" | "brand">, number[]> = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  "split-complementary": [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Small deterministic PRNG so "shuffle" is reproducible. */
function mulberry32(a: number): () => number {
  let s = a | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chromaBell(l: number): number {
  return Math.max(0.04, 1 - Math.pow((l - 0.62) / 0.5, 2));
}

/** Core hues for a scheme, seed first, all at the seed's lightness and chroma. */
export function generateHarmony(seedHex: string, scheme: HarmonyScheme, opts: { seed?: number } = {}): string[] {
  const hex = normalizeHex(seedHex) ?? "#000000";
  const base = toOklch(hex);
  if (scheme === "brand") {
    return generateBrandPalette({ seedHex: hex, personality: [], archetype: "", seed: opts.seed ?? 0 }).map((c) => c.hex);
  }
  if (scheme === "monochromatic") {
    const stops = [0.93, 0.78, 0.6, 0.42, 0.26];
    let nearest = 0;
    for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i] - base.l) < Math.abs(stops[nearest] - base.l)) nearest = i;
    return stops.map((l, i) => {
      if (i === nearest) return hex;
      const c = Math.min(base.c * 1.15, (base.c * chromaBell(l)) / chromaBell(base.l));
      return fromOklch({ l, c, h: base.h });
    });
  }
  return HUE_OFFSETS[scheme].map((off, i) => (i === 0 ? hex : fromOklch({ l: base.l, c: base.c, h: base.h + off })));
}

function secondaryLightness(baseL: number): number {
  return baseL >= 0.45 ? clamp(baseL - 0.22, 0.18, 0.5) : clamp(baseL + 0.28, 0.5, 0.8);
}

/** Guarantee readable text and a usable primary against the background. */
function enforceContrast(p: Record<BrandRole, string>): Record<BrandRole, string> {
  const out = { ...p };
  for (let i = 0; i < 12 && wcagRatio(out.text, out.background) < 7; i++) {
    const o = toOklch(out.text);
    out.text = fromOklch({ ...o, l: o.l - 0.03 });
  }
  for (let i = 0; i < 12 && wcagRatio(out.primary, out.background) < 3; i++) {
    const o = toOklch(out.primary);
    out.primary = fromOklch({ ...o, l: o.l - 0.03 });
  }
  return out;
}

function toSuggestions(p: Record<BrandRole, string>): PaletteSuggestion[] {
  const names = nameColors(BRAND_ROLES.map((r) => p[r]));
  return BRAND_ROLES.map((role, i) => ({ name: names[i], hex: p[role], role, usage: ROLE_USAGE[role] }));
}

/** Six role-assigned colours from a classic harmony scheme. */
export function harmonyToPalette(seedHex: string, scheme: HarmonyScheme, opts: { seed?: number } = {}): PaletteSuggestion[] {
  const hex = normalizeHex(seedHex) ?? "#000000";
  const seed = opts.seed ?? 0;
  if (scheme === "brand") return generateBrandPalette({ seedHex: hex, personality: [], archetype: "", seed });
  const rnd = mulberry32(seed * 7919 + 3);
  const jitter = seed === 0 ? () => 0 : () => rnd() * 2 - 1;
  const base = toOklch(hex);
  const baseC = Math.max(base.c, 0.03);
  const hues = generateHarmony(hex, scheme);
  let secondaryHue = base.h;
  let accentHue = base.h;
  if (scheme !== "monochromatic") {
    secondaryHue = hues.length > 2 ? toOklch(hues[1]).h : base.h;
    accentHue = toOklch(hues[hues.length - 1]).h;
  }
  const secL = clamp(secondaryLightness(base.l) + 0.04 * jitter(), 0.15, 0.82);
  const secondary = fromOklch({ l: secL, c: baseC * 0.8, h: secondaryHue + 6 * jitter() });
  const accent = fromOklch({
    l: clamp(0.7 + 0.05 * jitter(), 0.55, 0.8),
    c: scheme === "monochromatic" ? Math.max(baseC * 1.1, 0.12) : Math.max(baseC, 0.13),
    h: accentHue + 8 * jitter(),
  });
  const neutral = fromOklch({ l: 0.83, c: 0.025, h: base.h });
  const background = fromOklch({ l: 0.975, c: 0.008, h: base.h });
  const text = fromOklch({ l: 0.18, c: 0.02, h: base.h });
  return toSuggestions(enforceContrast({ primary: hex, secondary, accent, neutral, background, text }));
}

interface Traits {
  playful: number;
  authoritative: number;
  modern: number;
  expressive: number;
  premium: number;
  energetic: number;
}

const ARCHETYPE_BIAS: Partial<Record<Archetype, Partial<Traits>>> = {
  innocent: { playful: 0.1, premium: -0.1, energetic: -0.1 },
  everyman: { premium: -0.15, modern: -0.1 },
  hero: { energetic: 0.2, authoritative: 0.15, expressive: 0.1 },
  outlaw: { expressive: 0.25, energetic: 0.15, playful: 0.1 },
  explorer: { modern: 0.05, energetic: 0.05 },
  creator: { expressive: 0.25, playful: 0.1 },
  ruler: { premium: 0.25, authoritative: 0.2, energetic: -0.1 },
  magician: { expressive: 0.15, premium: 0.1 },
  lover: { premium: 0.15, expressive: 0.1, energetic: -0.05 },
  caregiver: { playful: 0.05, energetic: -0.15, premium: -0.05 },
  jester: { playful: 0.3, energetic: 0.2, expressive: 0.15 },
  sage: { authoritative: 0.15, energetic: -0.15, expressive: -0.1 },
};

/** Personality axes (0 = left label, 100 = right label) → 0..1 traits. */
export function readTraits(personality: PersonalityAxis[], archetype: Archetype = ""): Traits {
  const v = (id: string) => {
    const ax = personality.find((a) => a.id === id);
    return ax ? clamp(ax.value, 0, 100) / 100 : 0.5;
  };
  const t: Traits = {
    playful: 1 - v("playful-serious"),
    authoritative: v("friendly-authoritative"),
    modern: v("classic-modern"),
    expressive: v("minimal-expressive"),
    premium: v("accessible-premium"),
    energetic: v("calm-energetic"),
  };
  const bias = ARCHETYPE_BIAS[archetype] ?? {};
  for (const k of Object.keys(t) as (keyof Traits)[]) t[k] = clamp(t[k] + (bias[k] ?? 0), 0, 1);
  return t;
}

export const ARCHETYPE_SEEDS: Record<Exclude<Archetype, "">, { hex: string; note: string }> = {
  innocent: { hex: "#7FB8E6", note: "soft sky blue" },
  everyman: { hex: "#3E6B9C", note: "denim blue" },
  hero: { hex: "#C8102E", note: "strong red" },
  outlaw: { hex: "#9EF01A", note: "acid green" },
  explorer: { hex: "#2F6B4F", note: "forest green" },
  creator: { hex: "#E4572E", note: "vivid orange-red" },
  ruler: { hex: "#14213D", note: "deep navy" },
  magician: { hex: "#5B2A86", note: "deep purple" },
  lover: { hex: "#8C1D3F", note: "burgundy" },
  caregiver: { hex: "#5A9BD5", note: "soft blue" },
  jester: { hex: "#FF5E5B", note: "bright coral" },
  sage: { hex: "#1F5F8B", note: "considered blue" },
};

/** A starting seed derived from the archetype's colour guidance. */
export function archetypeSeed(archetype: Archetype): { hex: string; note: string } {
  return archetype ? ARCHETYPE_SEEDS[archetype] : { hex: "#3B5BDB", note: "a neutral starting blue" };
}

export interface BrandPaletteInput {
  seedHex: string;
  personality: PersonalityAxis[];
  archetype: Archetype;
  /** Vary the result while staying deterministic. */
  seed?: number;
}

/**
 * Six role-assigned colours whose chroma and lightness follow the brand's
 * personality: premium → darker, quieter secondary; playful → punchier accent;
 * calm → muted overall; classic → warm neutrals; modern → hue-tinted greys.
 */
export function generateBrandPalette({ seedHex, personality, archetype, seed = 0 }: BrandPaletteInput): PaletteSuggestion[] {
  const hex = normalizeHex(seedHex) ?? "#000000";
  const t = readTraits(personality, archetype);
  const rnd = mulberry32(seed * 1013 + 17);
  const j = () => rnd() * 2 - 1;
  const base = toOklch(hex);
  const baseC = Math.max(base.c, 0.03);
  const chromaMul = clamp(0.85 + 0.5 * (t.expressive - 0.5) + 0.35 * (t.energetic - 0.5) - 0.3 * (t.premium - 0.5), 0.5, 1.4);

  const primL = clamp(base.l - 0.06 * t.premium + 0.04 * t.playful, 0.3, 0.74);
  const primary = fromOklch({ l: primL, c: base.c * chromaMul, h: base.h });

  const spread = 25 + 55 * t.playful * t.expressive + 25 * t.energetic + 12 * j();
  const sign = j() >= 0 ? 1 : -1;
  const secL = clamp(0.42 - 0.16 * t.premium - 0.08 * t.authoritative + 0.05 * j(), 0.18, 0.5);
  const secC = clamp(baseC * (0.75 - 0.4 * t.premium) * chromaMul, 0.02, 0.2);
  const secondary = fromOklch({ l: secL, c: secC, h: base.h + sign * spread });

  const calm = t.expressive < 0.35 && t.energetic < 0.4;
  const accH = calm ? base.h + sign * (35 + 10 * j()) : base.h + 180 + j() * (25 + 35 * t.playful);
  const accL = clamp(0.66 + 0.1 * t.energetic - 0.06 * t.premium + 0.03 * j(), 0.55, 0.8);
  const accC = clamp((0.12 + 0.1 * t.playful + 0.06 * t.energetic + 0.05 * t.expressive - 0.06 * t.premium) * (calm ? 0.75 : 1), 0.05, 0.28);
  let accent = fromOklch({ l: accL, c: accC, h: accH });
  // Keep the accent distinguishable from the primary.
  const ao = toOklch(accent);
  if (hueDistance(ao.h, base.h) < 20 && Math.abs(ao.l - primL) < 0.15) accent = fromOklch({ ...ao, l: primL > 0.5 ? primL - 0.25 : primL + 0.25 });

  const neutralH = t.modern > 0.5 ? base.h : 75;
  const neutral = fromOklch({ l: 0.83 - 0.03 * t.premium, c: 0.02 + 0.02 * (1 - t.modern), h: neutralH });
  const background = fromOklch({ l: 0.985 - 0.02 * t.premium, c: 0.005 + 0.01 * (1 - t.modern), h: neutralH });
  const text = fromOklch({ l: 0.18 + 0.04 * (1 - t.authoritative), c: 0.015 + 0.02 * t.premium, h: base.h });

  return toSuggestions(enforceContrast({ primary, secondary, accent, neutral, background, text }));
}

/**
 * Merge suggestions into an existing palette: locked colours are kept, unlocked
 * colours with a matching role are replaced in place, missing roles are appended,
 * and unrelated extra colours (surface, success, custom…) are left alone.
 */
export function applySuggestions(existing: BrandColor[], suggestions: PaletteSuggestion[], makeId: () => string): BrandColor[] {
  const next: BrandColor[] = existing.map((c) => ({ ...c }));
  const used = new Set<number>();
  const appended: BrandColor[] = [];
  for (const s of suggestions) {
    const idx = next.findIndex((c, i) => c.role === s.role && !used.has(i));
    if (idx === -1) {
      appended.push({ id: makeId(), name: s.name, hex: s.hex, role: s.role, usage: s.usage, locked: false });
      continue;
    }
    used.add(idx);
    if (next[idx].locked) continue;
    next[idx] = { ...next[idx], hex: s.hex, name: s.name, usage: next[idx].usage || s.usage };
  }
  return [...next, ...appended];
}

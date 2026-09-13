/**
 * Guidelines model — turns the Brand Genome + project assets into a structured,
 * numbered document that the React viewer, the standalone HTML renderer and the
 * Markdown renderer all consume. Pure: no React, no DOM.
 */
import type { Genome, StageId, FontSpec, TypeStyle, PersonalityAxis, BrandColor } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { ARCHETYPES } from "@/lib/genome/archetypes";
import { STAGES } from "@/lib/genome/stages";
import { getLogoVariants, placeholderMarkSvg, placeholderWordmarkSvg, paletteColor, type LogoArtwork } from "@/lib/logo/assets";
import { bestTextOn, contrastReport, hexToRgb, relativeLuminance, type ContrastReport } from "@/lib/color/contrast";
import { hexToCmyk } from "@/lib/export/tokens";

/* ────────────────────────────── types ────────────────────────────── */

export interface ImageRef {
  assetId: string;
  name: string;
  mime: string;
  /** Resolved URL for on-screen rendering (object URL or data URL). May be "" when no resolver was given. */
  src: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface LogoRef {
  key: string;
  label: string;
  /** Normalised SVG markup (has a viewBox, no fixed width/height) */
  svg: string;
  placeholder: boolean;
  /** Which surface the tile should sit on */
  surface: "paper" | "ink" | "primary";
}

export interface Swatch {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
  rgbText: string;
  cmyk: { c: number; m: number; y: number; k: number };
  cmykText: string;
  role: BrandColor["role"];
  usage: string;
  textOn: "#000000" | "#ffffff";
  darkHex?: string;
}

export interface ContrastPair {
  fg: { name: string; hex: string };
  bg: { name: string; hex: string };
  report: ContrastReport;
}

export interface ScaleStep {
  name: string;
  px: number;
  rem: number;
}

export interface FontRole {
  role: "display" | "body" | "mono";
  label: string;
  spec: FontSpec;
  stack: string;
}

export interface DocTheme {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  display: FontSpec;
  body: FontSpec;
  mono: FontSpec;
  displayStack: string;
  bodyStack: string;
  monoStack: string;
}

export interface Missing {
  stage: StageId;
  stageLabel: string;
  message: string;
}

interface Base {
  id: string;
  /** Two-digit section number; "" for the cover */
  number: string;
  title: string;
}

export interface CoverSection extends Base {
  kind: "cover";
  name: string;
  tagline: string;
  logo: LogoRef;
  date: string;
  version: string;
  client: string;
}
export interface IntroSection extends Base {
  kind: "intro";
  /** Paragraphs of the brand story (from notes or composed from strategy) */
  story: string[];
  fromNotes: boolean;
  positioning: string;
  mission: string;
  vision: string;
  audience: string;
}
export interface StrategySection extends Base {
  kind: "strategy";
  values: string[];
  archetype: { name: string; drive: string; voice: string; examples: string; colors: string } | null;
  secondaryArchetype: { name: string; drive: string } | null;
  personality: PersonalityAxis[];
  keywords: string[];
  differentiators: string[];
}
export interface VoiceSection extends Base {
  kind: "voice";
  voice: string;
  dos: string[];
  donts: string[];
  sample: string;
}
export interface LogoSection extends Base {
  kind: "logo";
  concept: string;
  variants: LogoRef[];
  placeholder: boolean;
  clearspace: { multiplier: number; svg: string; description: string };
  /** `svg` is the mark, rendered at true size (px on screen, mm in print) by the renderers */
  minSize: { px: number; mm: number; svg: string };
  usageRules: string[];
  doNots: string[];
}
export interface ColorSection extends Base {
  kind: "color";
  rationale: string;
  swatches: Swatch[];
  contrast: ContrastPair[];
  dark: { name: string; light: string; dark: string }[];
}
export interface TypographySection extends Base {
  kind: "typography";
  rationale: string;
  fonts: FontRole[];
  scale: { base: number; ratio: number; steps: ScaleStep[] };
  styles: TypeStyle[];
  sampleHeadline: string;
  sampleBody: string;
}
export interface ImagerySection extends Base {
  kind: "imagery";
  attributes: { label: string; value: string }[];
  mood: string[];
  avoid: string[];
  guidance: string;
  references: ImageRef[];
  referencesLabel: string;
}
export interface ElementsSection extends Base {
  kind: "elements";
  shapes: string[];
  patterns: string[];
  iconStyle: { style: string; strokeWidth: number; cornerRadius: number };
  notes: string;
}
export interface MotionSection extends Base {
  kind: "motion";
  easing: string;
  durationBase: number;
  preset: string;
  principles: string[];
  notes: string;
  durations: { name: string; ms: number }[];
}
export interface ApplicationsSection extends Base {
  kind: "applications";
  images: ImageRef[];
}
export interface ColophonSection extends Base {
  kind: "colophon";
  client: string;
  project: string;
  industry: string;
  date: string;
  version: string;
  fonts: FontRole[];
  stages: { id: StageId; label: string; status: string }[];
  deliverables: string[];
}

export type GuidelinesSection =
  | CoverSection
  | IntroSection
  | StrategySection
  | VoiceSection
  | LogoSection
  | ColorSection
  | TypographySection
  | ImagerySection
  | ElementsSection
  | MotionSection
  | ApplicationsSection
  | ColophonSection;

export interface GuidelinesDoc {
  brand: { name: string; tagline: string; client: string; project: string; industry: string };
  date: string;
  dateIso: string;
  version: string;
  theme: DocTheme;
  sections: GuidelinesSection[];
  missing: Missing[];
  /** Google Fonts families to load (family → weights) */
  googleFonts: { family: string; weights: number[] }[];
}

export interface BuildOptions {
  /** Resolve an on-screen URL for a raster asset (e.g. the store's object-URL cache). */
  assetUrl?: (asset: Asset) => string;
}

/* ────────────────────────────── helpers ────────────────────────────── */

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<StageId, string>;

export function formatDocDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function stack(f: FontSpec): string {
  return `"${f.family}", ${f.fallback || "sans-serif"}`;
}

function paragraphs(s: string): string[] {
  return s
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Split an SVG string into its root attributes, viewBox and inner markup. */
export function svgParts(svg: string): { attrs: string; inner: string; viewBox: [number, number, number, number] } {
  const cleaned = svg
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const open = /<svg\b([^>]*)>/i.exec(cleaned);
  if (!open) return { attrs: "", inner: cleaned, viewBox: [0, 0, 512, 512] };
  const attrs = open[1];
  const start = open.index + open[0].length;
  const end = cleaned.lastIndexOf("</svg>");
  const inner = cleaned.slice(start, end > start ? end : undefined).trim();
  let viewBox: [number, number, number, number] = [0, 0, 512, 512];
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(attrs)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) viewBox = [vb[0], vb[1], vb[2], vb[3]];
  else {
    const w = parseFloat(/\bwidth\s*=\s*"([\d.]+)/i.exec(attrs)?.[1] ?? "");
    const h = parseFloat(/\bheight\s*=\s*"([\d.]+)/i.exec(attrs)?.[1] ?? "");
    if (w > 0 && h > 0) viewBox = [0, 0, w, h];
  }
  return { attrs, inner, viewBox };
}

/** Root gets a viewBox and loses fixed width/height so CSS can size it. */
export function normalizeLogoSvg(svg: string): string {
  const { attrs, inner, viewBox } = svgParts(svg);
  const keep = attrs
    .replace(/\s(width|height|viewBox|preserveAspectRatio|x|y)\s*=\s*"[^"]*"/gi, "")
    .replace(/\s(width|height|viewBox|preserveAspectRatio|x|y)\s*=\s*'[^']*'/gi, "")
    .trim();
  const xmlns = /xmlns\s*=/.test(keep) ? "" : ' xmlns="http://www.w3.org/2000/svg"';
  return `<svg${xmlns}${keep ? " " + keep : ""} viewBox="${viewBox.join(" ")}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

/** Embed an SVG inside another SVG's coordinate space. */
export function nestSvg(svg: string, x: number, y: number, width: number, height: number): string {
  const { inner, viewBox } = svgParts(svg);
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox.join(" ")}" preserveAspectRatio="xMidYMid meet" overflow="visible">${inner}</svg>`;
}

/** A generated horizontal lockup: placeholder mark tile + wordmark. */
export function placeholderLockupSvg(genome: Genome): string {
  const mark = placeholderMarkSvg(genome);
  const wm = placeholderWordmarkSvg(genome);
  const wmVb = svgParts(wm).viewBox;
  const wmH = 176;
  const wmW = (wmVb[2] / wmVb[3]) * wmH;
  const gap = 44;
  const W = 256 + gap + wmW;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(W)} 256" preserveAspectRatio="xMidYMid meet">${nestSvg(mark, 0, 0, 256, 256)}${nestSvg(wm, 256 + gap, (256 - wmH) / 2, wmW, wmH)}</svg>`;
}

/** Cover mark for placeholders: the brand initials inside a hairline ring, in the on-primary colour. */
export function coverMarkSvg(genome: Genome, fill: string): string {
  const words = (genome.visual.logo.wordmarkText || genome.name || "Brand").trim().split(/\s+/);
  const initials = escapeXml(words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""));
  const font = escapeXml(genome.visual.typography.display.family);
  const size = initials.length > 1 ? 104 : 132;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="128" cy="128" r="122" fill="none" stroke="${fill}" stroke-width="4"/><text x="128" y="${initials.length > 1 ? 166 : 176}" text-anchor="middle" font-family="${font}, serif" font-size="${size}" font-weight="600" fill="${fill}" letter-spacing="-3">${initials}</text></svg>`;
}

/**
 * Clearspace diagram: the logo with an exclusion zone of `x × multiplier`
 * on every side, where x is a quarter of the logo's height.
 */
export function clearspaceDiagramSvg(logoSvg: string, multiplier: number, ink = "#111111", accent = "#e0553f"): string {
  const { viewBox } = svgParts(logoSvg);
  const w = viewBox[2];
  const h = viewBox[3];
  const x = h * 0.25;
  const clear = x * Math.max(0.25, multiplier || 1);
  const margin = Math.max(clear * 0.9, h * 0.3);
  const W = w + clear * 2 + margin * 2;
  const H = h + clear * 2 + margin * 2;
  const ox = margin;
  const oy = margin;
  const fs = Math.max(9, Math.min(w, h) * 0.09);
  const dash = `${Math.max(2, fs * 0.5)} ${Math.max(2, fs * 0.35)}`;
  const line = (x1: number, y1: number, x2: number, y2: number, color = ink, dashed = false) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke"${dashed ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const label = (cx: number, cy: number, text: string, color = accent) =>
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${fs}" fill="${color}">${escapeXml(text)}</text>`;
  const parts: string[] = [];
  // exclusion zone
  parts.push(`<rect x="${ox}" y="${oy}" width="${w + clear * 2}" height="${h + clear * 2}" fill="none" stroke="${ink}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="${dash}"/>`);
  // logo bounds
  parts.push(`<rect x="${ox + clear}" y="${oy + clear}" width="${w}" height="${h}" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
  parts.push(nestSvg(logoSvg, ox + clear, oy + clear, w, h));
  // x unit marker (a square of x on the logo's top-left corner)
  const mx = ox + clear;
  const my = oy + clear;
  parts.push(`<rect x="${mx}" y="${my}" width="${x}" height="${x}" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
  parts.push(label(mx + x / 2, my + x / 2, "x"));
  // dimension ticks: left and top clearspace
  parts.push(line(ox, oy + clear + h / 2, ox + clear, oy + clear + h / 2, accent));
  parts.push(line(ox, oy + clear + h / 2 - fs * 0.5, ox, oy + clear + h / 2 + fs * 0.5, accent));
  parts.push(line(ox + clear, oy + clear + h / 2 - fs * 0.5, ox + clear, oy + clear + h / 2 + fs * 0.5, accent));
  parts.push(label(ox + clear / 2, oy + clear + h / 2 - fs * 0.9, multiplier === 1 ? "x" : `${trimNum(multiplier)}x`));
  parts.push(line(ox + clear + w / 2, oy, ox + clear + w / 2, oy + clear, accent));
  parts.push(line(ox + clear + w / 2 - fs * 0.5, oy, ox + clear + w / 2 + fs * 0.5, oy, accent));
  parts.push(line(ox + clear + w / 2 - fs * 0.5, oy + clear, ox + clear + w / 2 + fs * 0.5, oy + clear, accent));
  parts.push(label(ox + clear + w / 2 + fs * 1.6, oy + clear / 2, multiplier === 1 ? "x" : `${trimNum(multiplier)}x`));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${parts.join("")}</svg>`;
}

function trimNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const VARIANT_LABELS: Record<string, string> = {
  primary: "Primary lockup",
  horizontal: "Horizontal lockup",
  stacked: "Stacked lockup",
  mark: "Mark",
  wordmark: "Wordmark",
  "mono-dark": "One-colour, dark",
  "mono-light": "One-colour, light",
  favicon: "Favicon",
};
const VARIANT_ORDER = ["primary", "horizontal", "stacked", "mark", "wordmark", "mono-dark", "mono-light", "favicon"];

function surfaceFor(key: string): LogoRef["surface"] {
  if (key === "mono-light") return "ink";
  return "paper";
}

export function scaleSteps(base: number, ratio: number): ScaleStep[] {
  const names = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
  return names.map((name, i) => {
    const px = Math.round(base * Math.pow(ratio, i - 2) * 100) / 100;
    return { name, px, rem: Math.round((px / 16) * 1000) / 1000 };
  });
}

/* ────────────────────────────── theme ────────────────────────────── */

export function docTheme(genome: Genome): DocTheme {
  const t = genome.visual.typography;
  const primary = paletteColor(genome, "primary", "#1f1f1f");
  const accent = paletteColor(genome, "accent", primary);
  const bg = paletteColor(genome, "background", "#ffffff");
  const text = paletteColor(genome, "text", "#141414");
  const paper = relativeLuminance(bg) > 0.72 ? bg : "#ffffff";
  const ink = relativeLuminance(text) < 0.2 ? text : "#141414";
  return {
    paper,
    ink,
    muted: mix(ink, paper, 0.55),
    rule: mix(ink, paper, 0.16),
    primary,
    onPrimary: bestTextOn(primary),
    accent,
    onAccent: bestTextOn(accent),
    display: t.display,
    body: t.body,
    mono: t.mono,
    displayStack: stack(t.display),
    bodyStack: stack(t.body),
    monoStack: stack(t.mono),
  };
}

/** Linear mix of two hex colours (amount of `a`). */
export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x * amount + y * (1 - amount)).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/* ────────────────────────────── build ────────────────────────────── */

export function buildGuidelines(genome: Genome, assets: Asset[], opts: BuildOptions = {}): GuidelinesDoc {
  const theme = docTheme(genome);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const missing: Missing[] = [];
  const miss = (stage: StageId, message: string) => missing.push({ stage, stageLabel: STAGE_LABEL[stage], message });
  const imageRef = (a: Asset, caption?: string): ImageRef => ({
    assetId: a.id,
    name: a.name,
    mime: a.mime,
    src: a.kind === "svg" && a.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}` : (opts.assetUrl?.(a) ?? ""),
    width: a.width,
    height: a.height,
    caption,
  });

  const s = genome.strategy;
  const b = genome.brief;
  const v = genome.visual;
  const name = genome.name || "Untitled brand";
  const date = formatDocDate(genome.updatedAt);
  const dateIso = new Date(genome.updatedAt).toISOString().slice(0, 10);
  const version = `1.${genome.history.length}`;

  /* logo */
  const found = getLogoVariants(genome, assets);
  const hasLogo = Object.keys(found).length > 0;
  const toRef = (key: string, art: LogoArtwork): LogoRef => ({ key, label: VARIANT_LABELS[key] ?? key, svg: normalizeLogoSvg(art.svg), placeholder: art.source === "placeholder", surface: surfaceFor(key) });
  let variants: LogoRef[];
  if (hasLogo) {
    variants = VARIANT_ORDER.filter((k) => found[k as keyof typeof found]).map((k) => toRef(k, found[k as keyof typeof found]!));
    for (const k of Object.keys(found)) if (!VARIANT_ORDER.includes(k)) variants.push(toRef(k, found[k as keyof typeof found]!));
  } else {
    const ph = (key: string, svg: string): LogoRef => ({ key, label: VARIANT_LABELS[key] ?? key, svg: normalizeLogoSvg(svg), placeholder: true, surface: surfaceFor(key) });
    variants = [
      ph("primary", placeholderLockupSvg(genome)),
      ph("mark", placeholderMarkSvg(genome)),
      ph("wordmark", placeholderWordmarkSvg(genome)),
      ph("mono-dark", placeholderMarkSvg(genome, { mono: "dark" })),
      ph("mono-light", placeholderMarkSvg(genome, { mono: "light" })),
    ];
    miss("logo", "No logo variants yet — generated placeholders are shown. Build the mark and lockups in the Logo lab.");
  }
  const primaryLogoRef = variants.find((x) => x.key === "primary") ?? variants.find((x) => x.key === "horizontal") ?? variants.find((x) => x.key === "mark") ?? variants[0];
  const markRef = variants.find((x) => x.key === "mark") ?? primaryLogoRef;
  const monoKey = theme.onPrimary === "#ffffff" ? "mono-light" : "mono-dark";
  const coverLogo: LogoRef = hasLogo
    ? (variants.find((x) => x.key === monoKey) ?? primaryLogoRef)
    : { key: "cover", label: "Cover mark", svg: normalizeLogoSvg(coverMarkSvg(genome, theme.onPrimary)), placeholder: true, surface: "primary" };

  /* sections */
  const sections: GuidelinesSection[] = [];
  let n = 0;
  const num = () => pad2(++n);

  sections.push({
    kind: "cover",
    id: "cover",
    number: "",
    title: "Cover",
    name,
    tagline: s.tagline,
    logo: coverLogo,
    date,
    version,
    client: b.clientName,
  });
  if (!s.tagline) miss("strategy", "No tagline — the cover and social covers will show the brand name alone.");

  /* introduction */
  const notesParas = paragraphs(genome.notes);
  const story = notesParas.length ? notesParas : paragraphs(b.description);
  if (story.length || s.positioning || s.mission || s.vision) {
    sections.push({
      kind: "intro",
      id: "introduction",
      number: num(),
      title: "Introduction",
      story,
      fromNotes: notesParas.length > 0,
      positioning: s.positioning,
      mission: s.mission,
      vision: s.vision,
      audience: b.audience,
    });
  } else {
    miss("strategy", "No positioning, mission or vision — the Introduction is omitted.");
  }

  /* strategy */
  const arche = ARCHETYPES.find((a) => a.id === s.archetype);
  const arche2 = ARCHETYPES.find((a) => a.id === s.secondaryArchetype);
  const personality = s.personality.filter((p) => p.left && p.right);
  if (s.values.length || arche || s.differentiators.length || s.keywords.length) {
    sections.push({
      kind: "strategy",
      id: "strategy",
      number: num(),
      title: "Strategy",
      values: s.values,
      archetype: arche ? { name: arche.name, drive: arche.drive, voice: arche.voice, examples: arche.examples, colors: arche.colors } : null,
      secondaryArchetype: arche2 ? { name: arche2.name, drive: arche2.drive } : null,
      personality,
      keywords: s.keywords,
      differentiators: s.differentiators,
    });
  } else {
    miss("strategy", "No values or archetype — the Strategy section is omitted.");
  }

  /* voice */
  const tone = s.tone;
  if (tone.voice || tone.dos.length || tone.donts.length || tone.sample) {
    sections.push({ kind: "voice", id: "voice", number: num(), title: "Voice & tone", voice: tone.voice, dos: tone.dos, donts: tone.donts, sample: tone.sample });
  } else {
    miss("strategy", "No tone of voice — the Voice & tone section is omitted.");
  }

  /* logo */
  const logo = v.logo;
  sections.push({
    kind: "logo",
    id: "logo",
    number: num(),
    title: "Logo",
    concept: logo.concept,
    variants,
    placeholder: !hasLogo,
    clearspace: {
      multiplier: logo.clearspaceMultiplier,
      svg: clearspaceDiagramSvg(primaryLogoRef.svg, logo.clearspaceMultiplier, theme.ink, theme.accent),
      description: `Keep an exclusion zone of ${logo.clearspaceMultiplier === 1 ? "x" : `${trimNum(logo.clearspaceMultiplier)}x`} on every side, where x is a quarter of the logo's height. Nothing — type, imagery, other marks — may enter it.`,
    },
    minSize: { px: logo.minSizePx, mm: logo.minSizeMm, svg: markRef.svg },
    usageRules: logo.usageRules,
    doNots: logo.doNots,
  });
  if (!logo.usageRules.length && !logo.doNots.length) miss("logo", "No logo usage rules or don'ts defined yet.");

  /* colour */
  const colors = v.palette.colors;
  if (colors.length) {
    const swatches: Swatch[] = colors.map((c) => {
      const rgb = hexToRgb(c.hex);
      const cmyk = hexToCmyk(c.hex);
      return {
        id: c.id,
        name: c.name,
        hex: c.hex.toUpperCase(),
        rgb,
        rgbText: rgb.join(", "),
        cmyk,
        cmykText: `${cmyk.c} ${cmyk.m} ${cmyk.y} ${cmyk.k}`,
        role: c.role,
        usage: c.usage,
        textOn: bestTextOn(c.hex),
        darkHex: v.palette.dark[c.id]?.toUpperCase(),
      };
    });
    const byRole = (role: string) => colors.find((c) => c.role === role);
    const background = byRole("background") ?? { name: "White", hex: "#ffffff" };
    const surface = byRole("surface");
    const text = byRole("text") ?? { name: "Black", hex: "#000000" };
    const pairs: ContrastPair[] = [];
    const seen = new Set<string>();
    const addPair = (fg: { name: string; hex: string } | undefined, bg: { name: string; hex: string } | undefined) => {
      if (!fg || !bg || fg.hex.toLowerCase() === bg.hex.toLowerCase()) return;
      const key = `${fg.hex}/${bg.hex}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ fg: { name: fg.name, hex: fg.hex.toUpperCase() }, bg: { name: bg.name, hex: bg.hex.toUpperCase() }, report: contrastReport(fg.hex, bg.hex) });
    };
    addPair(text, background);
    if (surface) addPair(text, surface);
    for (const role of ["primary", "secondary", "accent"]) addPair(byRole(role), background);
    for (const role of ["primary", "secondary", "accent"]) {
      const c = byRole(role);
      if (c) addPair({ name: bestTextOn(c.hex) === "#ffffff" ? "White" : "Black", hex: bestTextOn(c.hex) }, c);
    }
    const dark = Object.entries(v.palette.dark)
      .map(([id, hex]) => {
        const c = colors.find((x) => x.id === id);
        return c ? { name: c.name, light: c.hex.toUpperCase(), dark: hex.toUpperCase() } : null;
      })
      .filter((x): x is { name: string; light: string; dark: string } => Boolean(x));
    sections.push({ kind: "color", id: "colour", number: num(), title: "Colour", rationale: v.palette.rationale, swatches, contrast: pairs, dark });
  } else {
    miss("color", "No palette yet — the Colour section is omitted and the cover falls back to near-black.");
  }

  /* typography */
  const t = v.typography;
  const fonts: FontRole[] = [
    { role: "display", label: "Display", spec: t.display, stack: stack(t.display) },
    { role: "body", label: "Body", spec: t.body, stack: stack(t.body) },
    { role: "mono", label: "Mono", spec: t.mono, stack: stack(t.mono) },
  ];
  sections.push({
    kind: "typography",
    id: "typography",
    number: num(),
    title: "Typography",
    rationale: t.rationale,
    fonts,
    scale: { base: t.scale.base, ratio: t.scale.ratio, steps: scaleSteps(t.scale.base, t.scale.ratio) },
    styles: t.styles,
    sampleHeadline: s.tagline || s.positioning.split(/[.!?]/)[0] || name,
    sampleBody: s.tone.sample || s.mission || b.description || "The quick brown fox jumps over the lazy dog.",
  });
  if (!t.rationale) miss("type", "No typographic rationale written yet.");

  /* imagery */
  const im = v.imagery;
  const attrs = [
    ["Medium", im.medium],
    ["Lighting", im.lighting],
    ["Composition", im.composition],
    ["Colour treatment", im.colorTreatment],
    ["Subjects", im.subjects],
  ]
    .filter(([, val]) => val)
    .map(([label, value]) => ({ label, value }));
  const refAssets = im.referenceAssetIds.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a && a.kind === "image"));
  const imageryGenerated = refAssets.length ? [] : assets.filter((a) => a.kind === "image" && a.stage === "imagery").slice(0, 6);
  const references = (refAssets.length ? refAssets : imageryGenerated).map((a) => imageRef(a, a.name));
  if (attrs.length || im.mood.length || im.avoid.length || im.guidance || references.length) {
    sections.push({
      kind: "imagery",
      id: "imagery",
      number: num(),
      title: "Imagery",
      attributes: attrs,
      mood: im.mood,
      avoid: im.avoid,
      guidance: im.guidance,
      references,
      referencesLabel: refAssets.length ? "Reference images" : "On-brand imagery",
    });
    if (!references.length) miss("imagery", "No reference images — generate or upload imagery in the Imagery lab to illustrate the style.");
  } else {
    miss("imagery", "No imagery style defined — the Imagery section is omitted.");
  }

  /* elements */
  const el = v.elements;
  if (el.shapes.length || el.patterns.length || el.notes) {
    sections.push({ kind: "elements", id: "elements", number: num(), title: "Graphic elements", shapes: el.shapes, patterns: el.patterns, iconStyle: el.iconStyle, notes: el.notes });
  }

  /* motion */
  const mo = v.motion;
  if (mo.principles.length || mo.notes) {
    const base = mo.durationBase;
    sections.push({
      kind: "motion",
      id: "motion",
      number: num(),
      title: "Motion",
      easing: mo.easing,
      durationBase: base,
      preset: mo.preset,
      principles: mo.principles,
      notes: mo.notes,
      durations: [
        { name: "Instant (hover, focus)", ms: Math.round(base * 0.25) },
        { name: "Quick (toggles, tooltips)", ms: Math.round(base * 0.5) },
        { name: "Base (panels, cards)", ms: base },
        { name: "Slow (page reveals)", ms: Math.round(base * 1.5) },
        { name: "Cinematic (logo, hero)", ms: base * 2 },
      ],
    });
  } else {
    miss("motion", "No motion principles — the Motion section is omitted.");
  }

  /* applications */
  const mockups = assets.filter((a) => a.kind === "image" && a.stage === "mockups").map((a) => imageRef(a, a.name));
  if (mockups.length) {
    sections.push({ kind: "applications", id: "applications", number: num(), title: "Applications", images: mockups });
  } else {
    miss("mockups", "No mockups yet — the Applications section is omitted.");
  }

  /* colophon */
  sections.push({
    kind: "colophon",
    id: "colophon",
    number: num(),
    title: "Colophon",
    client: b.clientName,
    project: b.projectName,
    industry: b.industry,
    date,
    version,
    fonts,
    stages: STAGES.map((st) => ({ id: st.id, label: st.label, status: genome.stages[st.id] ?? "todo" })),
    deliverables: b.deliverables,
  });

  const googleFonts = [t.display, t.body, t.mono]
    .filter((f) => f.source === "google" && f.family)
    .reduce<{ family: string; weights: number[] }[]>((acc, f) => {
      const existing = acc.find((x) => x.family === f.family);
      const weights = [...new Set([...(f.weights.length ? f.weights : [400]), 400])].sort((a, b) => a - b);
      if (existing) existing.weights = [...new Set([...existing.weights, ...weights])].sort((a, b) => a - b);
      else acc.push({ family: f.family, weights });
      return acc;
    }, []);

  return {
    brand: { name, tagline: s.tagline, client: b.clientName, project: b.projectName, industry: b.industry },
    date,
    dateIso,
    version,
    theme,
    sections,
    missing,
    googleFonts,
  };
}

/** Table-of-contents entries (numbered sections only). */
export function tableOfContents(doc: GuidelinesDoc): { id: string; number: string; title: string }[] {
  return doc.sections.filter((s) => s.kind !== "cover").map((s) => ({ id: s.id, number: s.number, title: s.title }));
}

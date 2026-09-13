/**
 * Specimen copy and character-set helpers derived from the Brand Genome.
 * Pure — no React, no DOM.
 */
import type { Genome } from "@/lib/genome/schema";
import { hexToRgb, relativeLuminance, rgbToHex, wcagRatio } from "@/lib/color/contrast";

export const PANGRAMS = [
  "Sphinx of black quartz, judge my vow.",
  "The quick brown fox jumps over the lazy dog.",
  "Pack my box with five dozen liquor jugs.",
  "How vexingly quick daft zebras jump!",
  "Jackdaws love my big sphinx of quartz.",
];

export const NUMERALS_SAMPLE = "0123456789 · $1,234.56 · 12:45 · 20% · №7 · ½ ¾ · +44 20 7946 0958";
export const LIGATURES_SAMPLE = "fi fl ff ffi ffl st ct Th · Qu æ œ · & @ § ¶ · → ← · ‘single’ “double” · 1/2 → ½";

export const ARABIC_SAMPLE = {
  headline: "هوية بصرية بروح المكان",
  subhead: "خطوط عربية متناسقة مع النظام اللاتيني",
  paragraph: "صِف خَلقَ خَودِ كَمِثلِ الشَمسِ إِذ بَزَغَت يَحظى الضَجيعُ بِها نَجلاءَ مِعطارِ. نصوص عربية واضحة تعمل على الشاشة وفي الطباعة، بأوزان متعددة وتباعد مريح.",
  numerals: "٠١٢٣٤٥٦٧٨٩ · ١٢:٤٥ · ٪٢٠",
  caption: "عيّنة طباعية — النص العربي",
};

export interface CharacterSet {
  id: string;
  label: string;
  glyphs: string[];
  rtl?: boolean;
}

const CHARSETS: Record<string, string> = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numerals: "0123456789",
  punctuation: ".,;:!?¡¿'\"“”‘’()[]{}—–-…&@#%*/+=<>~^_|",
  currency: "$€£¥₹¢",
  accented: "ÀÁÂÄÅÆÇÈÉÊËÑÒÓÔÖØÙÚÛÜÝàáâäåæçèéêëñòóôöøùúûüýßÞð",
  arabic: "ابتثجحخدذرزسشصضطظعغفقكلمنهوي",
  arabicNumerals: "٠١٢٣٤٥٦٧٨٩",
};

const LABELS: Record<string, string> = {
  uppercase: "Uppercase",
  lowercase: "Lowercase",
  numerals: "Numerals",
  punctuation: "Punctuation & symbols",
  currency: "Currency",
  accented: "Accented",
  arabic: "Arabic",
  arabicNumerals: "Arabic-Indic numerals",
};

export function splitGlyphs(s: string): string[] {
  return Array.from(s);
}

/** Character sets for the specimen; Arabic rows are included only when requested. */
export function characterSets(opts: { arabic?: boolean } = {}): CharacterSet[] {
  const ids = ["uppercase", "lowercase", "numerals", "punctuation", "currency", "accented", ...(opts.arabic ? ["arabic", "arabicNumerals"] : [])];
  return ids.map((id) => ({ id, label: LABELS[id], glyphs: splitGlyphs(CHARSETS[id]), rtl: id.startsWith("arabic") }));
}

export interface SpecimenTexts {
  brand: string;
  headline: string;
  subhead: string;
  paragraph: string;
  list: string[];
  caption: string;
  numerals: string;
  ligatures: string;
  pangram: string;
}

function firstSentence(s: string): string {
  const m = /^[^.!?]+[.!?]?/.exec(s.trim());
  return (m ? m[0] : s).trim();
}

/** Sample copy for the specimen, drawn from the brief and strategy with safe fallbacks. */
export function specimenTexts(genome: Genome): SpecimenTexts {
  const { strategy, brief } = genome;
  const brand = brief.clientName || genome.name || "Your brand";
  const headline = strategy.tagline || (strategy.positioning ? firstSentence(strategy.positioning) : "") || brand;
  const subhead = strategy.mission || strategy.vision || (brief.description ? firstSentence(brief.description) : "") || "A typographic system built for every surface the brand touches.";
  const paragraph =
    brief.description ||
    strategy.positioning ||
    strategy.tone?.sample ||
    "Typography carries the voice of a brand before a single word is read. The display face sets the tone; the text face does the quiet work of being read for hours without complaint.";
  const list = strategy.values.length ? strategy.values : strategy.differentiators.length ? strategy.differentiators : ["Clarity", "Warmth", "Consistency", "Craft"];
  const caption = [brief.industry, brief.clientName].filter(Boolean).join(" · ") || "Figure 01 · Specimen";
  return { brand, headline, subhead, paragraph, list: list.slice(0, 5), caption, numerals: NUMERALS_SAMPLE, ligatures: LIGATURES_SAMPLE, pangram: PANGRAMS[0] };
}

export interface SpecimenPalette {
  bg: string;
  text: string;
  muted: string;
  primary: string;
  /** true when colours came from the brand palette rather than UI tokens */
  branded: boolean;
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(Math.round(r1 + (r2 - r1) * k), Math.round(g1 + (g2 - g1) * k), Math.round(b1 + (b2 - b1) * k));
}

/** Light and dark specimen colours from the Genome palette, falling back to UI tokens. */
export function specimenPalette(genome: Genome): { light: SpecimenPalette; dark: SpecimenPalette } {
  const colors = genome.visual.palette.colors;
  const role = (r: string) => colors.find((c) => c.role === r)?.hex;
  const primary = role("primary") ?? role("accent");
  if (!colors.length || !primary) {
    return {
      light: { bg: "var(--bg-elev)", text: "var(--fg)", muted: "var(--fg-muted)", primary: "var(--accent)", branded: false },
      dark: { bg: "var(--bg-inset)", text: "var(--fg)", muted: "var(--fg-muted)", primary: "var(--accent)", branded: false },
    };
  }
  const lightBg = role("background") ?? "#FFFFFF";
  const ink = role("text") ?? (relativeLuminance(lightBg) > 0.5 ? "#111111" : "#FFFFFF");
  const lightPrimary = wcagRatio(primary, lightBg) >= 3 ? primary : mixHex(primary, ink, 0.35);
  const darkCandidates = [role("secondary"), role("text"), role("neutral")].filter((h): h is string => Boolean(h) && relativeLuminance(h as string) < 0.2);
  const darkBg = darkCandidates[0] ?? mixHex(ink, "#000000", 0.4);
  const darkText = relativeLuminance(lightBg) > 0.6 ? lightBg : "#FFFFFF";
  const darkPrimary = wcagRatio(primary, darkBg) >= 3 ? primary : mixHex(primary, "#FFFFFF", 0.4);
  return {
    light: { bg: lightBg, text: ink, muted: mixHex(ink, lightBg, 0.4), primary: lightPrimary, branded: true },
    dark: { bg: darkBg, text: darkText, muted: mixHex(darkText, darkBg, 0.4), primary: darkPrimary, branded: true },
  };
}

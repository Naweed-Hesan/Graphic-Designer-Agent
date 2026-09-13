/**
 * Curated Google Fonts pairings and a small scoring engine that matches them
 * to a brand's personality axes and archetype. Pure — no React, no DOM.
 */
import type { Archetype, PersonalityAxis } from "@/lib/genome/schema";
import { findFont, type FontLike } from "./fontmeta";

export type Mood =
  | "playful"
  | "serious"
  | "friendly"
  | "authoritative"
  | "classic"
  | "modern"
  | "minimal"
  | "expressive"
  | "accessible"
  | "premium"
  | "calm"
  | "energetic"
  | "editorial"
  | "tech"
  | "warm"
  | "elegant"
  | "bold"
  | "arabic"
  | "handwritten";

export interface CuratedPair {
  display: string;
  body: string;
  displayCategory: string;
  bodyCategory: string;
  rationale: string;
  moods: Mood[];
}

const P = (display: string, dc: string, body: string, bc: string, rationale: string, moods: Mood[]): CuratedPair => ({ display, displayCategory: dc, body, bodyCategory: bc, rationale, moods });

/** ~40 well-known pairs. Every family here exists in the bundled fallback list so previews work offline-first. */
export const CURATED_PAIRS: CuratedPair[] = [
  P("Fraunces", "serif", "Inter", "sans-serif", "Soft, slightly wonky serif headlines against the most neutral workhorse body on the web.", ["warm", "editorial", "modern", "premium", "friendly"]),
  P("Playfair Display", "serif", "Source Sans 3", "sans-serif", "High-contrast Didone display with a humanist sans that stays out of its way.", ["classic", "elegant", "editorial", "premium", "serious"]),
  P("DM Serif Display", "serif", "DM Sans", "sans-serif", "One superfamily, two voices: a sharp serif display and a low-contrast geometric text face.", ["modern", "minimal", "premium", "calm"]),
  P("Space Grotesk", "sans-serif", "Inter", "sans-serif", "Quirky grotesk headlines over plain-spoken body copy — the software-startup staple.", ["modern", "tech", "minimal", "energetic"]),
  P("Syne", "sans-serif", "Inter", "sans-serif", "Extended, opinionated display weights for loud statements, kept honest by a neutral text face.", ["expressive", "modern", "bold", "energetic", "playful"]),
  P("Bricolage Grotesque", "sans-serif", "Instrument Sans", "sans-serif", "Two contemporary grotesks with optical sizes; warm, slightly eccentric, very current.", ["modern", "friendly", "expressive", "warm"]),
  P("Cormorant Garamond", "serif", "Montserrat", "sans-serif", "Delicate old-style serif with a wide geometric sans — fashion, hospitality, fragrance.", ["classic", "elegant", "premium", "expressive"]),
  P("Instrument Serif", "serif", "Geist", "sans-serif", "Condensed editorial serif over a crisp, engineered sans — the current design-tool look.", ["modern", "editorial", "minimal", "premium", "tech"]),
  P("Unbounded", "display", "Manrope", "sans-serif", "Wide, rounded display for headlines that shout; Manrope keeps supporting copy calm.", ["bold", "expressive", "energetic", "playful", "modern"]),
  P("Bodoni Moda", "serif", "Lato", "sans-serif", "Fashion-house Bodoni contrast with a friendly, unfussy sans.", ["classic", "premium", "elegant", "serious"]),
  P("Newsreader", "serif", "Work Sans", "sans-serif", "Newspaper serif with a sturdy grotesk — reads like a well-edited magazine.", ["editorial", "classic", "serious", "accessible"]),
  P("Libre Baskerville", "serif", "Public Sans", "sans-serif", "Transitional book serif with a civic sans — trustworthy, plain and readable.", ["classic", "serious", "accessible", "authoritative"]),
  P("Tajawal", "sans-serif", "Cairo", "sans-serif", "Two Arabic-first sans faces: Tajawal's flowing headlines, Cairo's sturdy, bilingual text.", ["arabic", "modern", "friendly", "accessible"]),
  P("Noto Naskh Arabic", "serif", "Noto Sans Arabic", "sans-serif", "Traditional Naskh headlines with a modern Arabic sans body — safe across scripts.", ["arabic", "classic", "serious", "accessible"]),
  P("Readex Pro", "sans-serif", "Almarai", "sans-serif", "Open, geometric Arabic sans pair with generous spacing — very legible on screens.", ["arabic", "modern", "minimal", "friendly"]),
  P("Changa", "sans-serif", "Vazirmatn", "sans-serif", "Punchy Kufi-flavoured display weights with a quiet, contemporary Arabic text face.", ["arabic", "bold", "modern", "energetic"]),
  P("Amiri", "serif", "IBM Plex Sans Arabic", "sans-serif", "Classical Naskh calligraphy for headlines against an engineered bilingual sans.", ["arabic", "classic", "elegant", "premium"]),
  P("Lora", "serif", "Nunito Sans", "sans-serif", "Calligraphic serif with a rounded humanist sans — approachable and warm.", ["warm", "friendly", "classic", "accessible", "calm"]),
  P("Merriweather", "serif", "Open Sans", "sans-serif", "Screen-first serif and sans that have been paired on the web for a decade.", ["classic", "accessible", "serious", "calm"]),
  P("EB Garamond", "serif", "Figtree", "sans-serif", "Renaissance serif meets a friendly geometric sans — heritage with a modern edge.", ["classic", "elegant", "friendly", "premium"]),
  P("Libre Caslon Text", "serif", "Karla", "sans-serif", "Caslon's bookish charm against Karla's slightly quirky grotesk.", ["classic", "editorial", "friendly", "warm"]),
  P("Abril Fatface", "display", "Poppins", "sans-serif", "Fat-face poster serif for punchy headlines with a clean geometric sans.", ["bold", "expressive", "playful", "energetic"]),
  P("Bebas Neue", "display", "Lato", "sans-serif", "Condensed all-caps headlines, athletic and direct; Lato keeps the copy friendly.", ["bold", "energetic", "authoritative", "accessible"]),
  P("Oswald", "sans-serif", "Merriweather", "serif", "Condensed gothic headlines over a wide, comfortable reading serif.", ["bold", "serious", "authoritative", "classic"]),
  P("Archivo Black", "display", "Archivo", "sans-serif", "Heavy grotesk display and its regular sibling — one voice at two volumes.", ["bold", "modern", "minimal", "authoritative"]),
  P("Cinzel", "serif", "Raleway", "sans-serif", "Roman inscriptional capitals with an elegant thin sans — luxury and heritage.", ["premium", "classic", "elegant", "authoritative"]),
  P("Italiana", "serif", "Lato", "sans-serif", "Hairline, Didone-inspired display for beauty and fashion; Lato for legibility.", ["elegant", "premium", "minimal", "calm"]),
  P("Prata", "serif", "Work Sans", "sans-serif", "Glossy Didone with a plain, wide sans — polished without being precious.", ["elegant", "premium", "classic"]),
  P("Young Serif", "serif", "Rubik", "sans-serif", "Chunky, friendly serif with a rounded sans — playful but grown-up.", ["playful", "friendly", "warm", "expressive"]),
  P("Outfit", "sans-serif", "Source Serif 4", "serif", "Geometric sans headlines over a serif body — inverts the usual hierarchy.", ["modern", "minimal", "editorial", "tech"]),
  P("Plus Jakarta Sans", "sans-serif", "Lora", "serif", "Rounded modern sans for headlines, calligraphic serif for long reads.", ["modern", "warm", "friendly", "accessible"]),
  P("Sora", "sans-serif", "IBM Plex Mono", "monospace", "Geometric tech display with a mono body — developer-tool energy.", ["tech", "modern", "minimal", "serious"]),
  P("Red Hat Display", "sans-serif", "Red Hat Text", "sans-serif", "Optically paired display and text cuts of one humanist sans.", ["modern", "accessible", "friendly", "minimal"]),
  P("Epilogue", "sans-serif", "Crimson Pro", "serif", "Wide, contemporary sans with a classic old-style text serif.", ["modern", "editorial", "expressive"]),
  P("Gloock", "serif", "Hanken Grotesk", "sans-serif", "High-contrast display serif with a clean neutral grotesk.", ["elegant", "modern", "editorial", "premium"]),
  P("Righteous", "display", "Nunito", "sans-serif", "Retro geometric display with a rounded sans — sunny and upbeat.", ["playful", "energetic", "friendly", "expressive"]),
  P("Caveat", "handwriting", "Nunito", "sans-serif", "Handwritten headlines over a rounded sans — casual and personal.", ["playful", "friendly", "warm", "handwritten", "expressive"]),
  P("League Spartan", "sans-serif", "Libre Baskerville", "serif", "Heavy geometric sans with a transitional serif — confident and bookish.", ["bold", "classic", "modern", "authoritative"]),
  P("Josefin Sans", "sans-serif", "Cardo", "serif", "Art-deco geometric sans with an old-style serif — vintage elegance.", ["classic", "elegant", "expressive", "premium"]),
  P("Marcellus", "serif", "Mulish", "sans-serif", "Roman capitals with a soft humanist sans — quiet, considered luxury.", ["elegant", "calm", "classic", "premium"]),
  P("Schibsted Grotesk", "sans-serif", "Newsreader", "serif", "News pairing: sharp grotesk headlines, Newsreader for the story.", ["editorial", "serious", "modern", "authoritative"]),
  P("Anton", "display", "Roboto", "sans-serif", "Impact-style condensed display with the default screen sans — loud and practical.", ["bold", "energetic", "accessible"]),
  P("Vollkorn", "serif", "Alegreya Sans", "sans-serif", "Robust book serif with a lively humanist sans — warm and literary.", ["classic", "warm", "editorial", "friendly"]),
  P("Manrope", "sans-serif", "Inter", "sans-serif", "Two calm sans faces — Manrope for slightly softer headlines, Inter for everything else.", ["minimal", "modern", "calm", "accessible", "tech"]),
];

/** Personality axis id → [left mood, right mood]. */
export const AXIS_MOODS: Record<string, [Mood, Mood]> = {
  "playful-serious": ["playful", "serious"],
  "friendly-authoritative": ["friendly", "authoritative"],
  "classic-modern": ["classic", "modern"],
  "minimal-expressive": ["minimal", "expressive"],
  "accessible-premium": ["accessible", "premium"],
  "calm-energetic": ["calm", "energetic"],
};

export const ARCHETYPE_MOODS: Record<Exclude<Archetype, "">, Mood[]> = {
  innocent: ["friendly", "calm", "accessible", "warm"],
  everyman: ["friendly", "accessible", "warm"],
  hero: ["bold", "energetic", "authoritative", "serious"],
  outlaw: ["bold", "expressive", "energetic"],
  explorer: ["modern", "warm", "expressive", "editorial"],
  creator: ["expressive", "modern", "playful"],
  ruler: ["authoritative", "premium", "classic", "elegant"],
  magician: ["expressive", "elegant", "premium", "modern"],
  lover: ["elegant", "premium", "warm", "expressive"],
  caregiver: ["friendly", "calm", "warm", "accessible"],
  jester: ["playful", "energetic", "expressive", "bold"],
  sage: ["serious", "classic", "minimal", "editorial", "calm", "authoritative"],
};

export interface PairSuggestion {
  display: string;
  body: string;
  displayCategory: string;
  bodyCategory: string;
  rationale: string;
  moods: Mood[];
  score: number;
  reasons: string[];
  curated: boolean;
}

function axisPoles(axis: PersonalityAxis): [Mood, Mood] | null {
  const byId = AXIS_MOODS[axis.id];
  if (byId) return byId;
  const l = axis.left.toLowerCase() as Mood;
  const r = axis.right.toLowerCase() as Mood;
  const known = new Set<string>(Object.values(AXIS_MOODS).flat());
  return known.has(l) && known.has(r) ? [l, r] : null;
}

/** Score a mood set against the personality sliders. Returns the score and human reasons. */
export function scoreMoods(moods: Mood[], personality: PersonalityAxis[]): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const set = new Set(moods);
  for (const axis of personality) {
    const poles = axisPoles(axis);
    if (!poles) continue;
    const [left, right] = poles;
    const lean = (axis.value / 100 - 0.5) * 2; // -1 (left) … +1 (right)
    if (set.has(right)) {
      score += lean;
      if (lean > 0.2) reasons.push(`${axis.right.toLowerCase()} (${axis.value})`);
    }
    if (set.has(left)) {
      score -= lean;
      if (lean < -0.2) reasons.push(`${axis.left.toLowerCase()} (${100 - axis.value})`);
    }
  }
  return { score, reasons };
}

function archetypeName(a: Archetype): string {
  return a ? a.charAt(0).toUpperCase() + a.slice(1) : "";
}

export interface SuggestOptions {
  fonts: FontLike[];
  personality: PersonalityAxis[];
  archetype?: Archetype;
  secondaryArchetype?: Archetype;
  /** Boost pairs that keep this display family. */
  currentDisplay?: string;
  /** The brand needs Arabic script; Arabic-first pairs are boosted instead of demoted. */
  arabic?: boolean;
  limit?: number;
}

/** Rank curated pairs for the brand. Pairs whose families are unknown to the font list are skipped. */
export function suggestPairings({ fonts, personality, archetype = "", secondaryArchetype = "", currentDisplay, arabic = false, limit = 8 }: SuggestOptions): PairSuggestion[] {
  const known = fonts.length ? new Set(fonts.map((f) => f.family.toLowerCase())) : null;
  const out: PairSuggestion[] = [];
  CURATED_PAIRS.forEach((pair, index) => {
    if (known && (!known.has(pair.display.toLowerCase()) || !known.has(pair.body.toLowerCase()))) return;
    const { score: axisScore, reasons } = scoreMoods(pair.moods, personality);
    let score = axisScore - index * 0.001; // stable ordering for ties
    const set = new Set(pair.moods);

    if (archetype) {
      const hits = (ARCHETYPE_MOODS[archetype] ?? []).filter((m) => set.has(m));
      if (hits.length) {
        score += 0.6 * hits.length;
        reasons.push(`${archetypeName(archetype)} archetype`);
      }
    }
    if (secondaryArchetype && secondaryArchetype !== archetype) {
      const hits = (ARCHETYPE_MOODS[secondaryArchetype] ?? []).filter((m) => set.has(m));
      if (hits.length) score += 0.3 * hits.length;
    }

    const dCat = (known && findFont(fonts, pair.display)?.category) || pair.displayCategory;
    const bCat = (known && findFont(fonts, pair.body)?.category) || pair.bodyCategory;
    if (dCat !== bCat) {
      score += 0.5;
      reasons.push(`${dCat} × ${bCat} contrast`);
    }

    if (set.has("arabic")) {
      if (arabic) {
        score += 2.5;
        reasons.unshift("Arabic script");
      } else score -= 4;
    } else if (arabic) score -= 1.5;

    if (currentDisplay && pair.display.toLowerCase() === currentDisplay.toLowerCase()) {
      score += 1;
      reasons.unshift(`keeps ${pair.display}`);
    }

    out.push({ ...pair, score, reasons, curated: true });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

interface BodyCandidate {
  family: string;
  category: string;
  note: string;
  moods: Mood[];
}

/** Reliable text faces to propose when no curated pair exists for a display family. */
export const BODY_CANDIDATES: BodyCandidate[] = [
  { family: "Inter", category: "sans-serif", note: "neutral grotesk with a huge x-height; excellent at small sizes", moods: ["modern", "minimal", "accessible", "tech"] },
  { family: "Source Sans 3", category: "sans-serif", note: "humanist and warm, drawn for interface text", moods: ["friendly", "accessible", "classic"] },
  { family: "Work Sans", category: "sans-serif", note: "slightly wide grotesk that stays friendly at text sizes", moods: ["friendly", "modern", "editorial"] },
  { family: "DM Sans", category: "sans-serif", note: "low-contrast geometric; clean and contemporary", moods: ["modern", "minimal", "calm"] },
  { family: "Manrope", category: "sans-serif", note: "semi-geometric, calm and modern", moods: ["modern", "minimal", "calm", "tech"] },
  { family: "Public Sans", category: "sans-serif", note: "civic, neutral and very legible", moods: ["accessible", "serious", "minimal"] },
  { family: "Figtree", category: "sans-serif", note: "friendly geometric with generous spacing", moods: ["friendly", "playful", "modern"] },
  { family: "IBM Plex Sans", category: "sans-serif", note: "engineered grotesk with character", moods: ["tech", "serious", "modern"] },
  { family: "Nunito Sans", category: "sans-serif", note: "rounded terminals; approachable", moods: ["friendly", "warm", "accessible"] },
  { family: "Lato", category: "sans-serif", note: "warm semi-rounded humanist; a safe default", moods: ["friendly", "accessible", "calm"] },
  { family: "Karla", category: "sans-serif", note: "quirky grotesk that adds personality to text", moods: ["expressive", "friendly", "editorial"] },
  { family: "Instrument Sans", category: "sans-serif", note: "contemporary grotesk with subtle warmth", moods: ["modern", "warm", "minimal"] },
  { family: "Geist", category: "sans-serif", note: "crisp, engineered sans for product surfaces", moods: ["tech", "modern", "minimal"] },
  { family: "Source Serif 4", category: "serif", note: "transitional text serif with optical sizes", moods: ["classic", "editorial", "serious"] },
  { family: "Lora", category: "serif", note: "calligraphic roots; comfortable for long reads", moods: ["warm", "classic", "friendly"] },
  { family: "Literata", category: "serif", note: "designed for e-books; superb at 16px", moods: ["classic", "accessible", "calm"] },
  { family: "Crimson Pro", category: "serif", note: "old-style book serif, quietly classic", moods: ["classic", "elegant", "editorial"] },
  { family: "Newsreader", category: "serif", note: "newspaper text serif with optical sizes", moods: ["editorial", "serious", "classic"] },
  { family: "Merriweather", category: "serif", note: "sturdy screen serif with a large x-height", moods: ["classic", "accessible", "serious"] },
  { family: "Spectral", category: "serif", note: "elegant screen serif with sharp details", moods: ["elegant", "editorial", "premium"] },
];

/** Suggest body faces for a chosen display family: curated partners first, then reliable text faces that contrast well. */
export function pairFor(displayFamily: string, fonts: FontLike[], opts: { personality?: PersonalityAxis[]; limit?: number } = {}): PairSuggestion[] {
  const { personality = [], limit = 8 } = opts;
  const known = fonts.length ? new Set(fonts.map((f) => f.family.toLowerCase())) : null;
  const isKnown = (fam: string) => !known || known.has(fam.toLowerCase());
  const meta = findFont(fonts, displayFamily);
  const curatedCat = CURATED_PAIRS.find((p) => p.display.toLowerCase() === displayFamily.toLowerCase())?.displayCategory;
  const dCat = meta?.category ?? curatedCat ?? "sans-serif";
  const out: PairSuggestion[] = [];
  const seen = new Set<string>();

  for (const pair of CURATED_PAIRS) {
    if (pair.display.toLowerCase() !== displayFamily.toLowerCase() || !isKnown(pair.body)) continue;
    const { score, reasons } = scoreMoods(pair.moods, personality);
    seen.add(pair.body.toLowerCase());
    out.push({ ...pair, display: displayFamily, score: 5 + score, reasons: ["curated pairing", ...reasons], curated: true });
  }

  const decorative = dCat === "display" || dCat === "handwriting";
  BODY_CANDIDATES.forEach((c, index) => {
    if (c.family.toLowerCase() === displayFamily.toLowerCase() || seen.has(c.family.toLowerCase()) || !isKnown(c.family)) return;
    const { score: axisScore, reasons } = scoreMoods(c.moods, personality);
    let score = 1 + axisScore - index * 0.01;
    if (c.category !== dCat) {
      score += 0.8;
      reasons.unshift(`${dCat} × ${c.category} contrast`);
    }
    if (decorative && c.category === "sans-serif") {
      score += 0.4;
      reasons.push("quiet text face under a decorative display");
    }
    if (dCat === "serif" && c.category === "serif") score -= 0.6;
    out.push({
      display: displayFamily,
      body: c.family,
      displayCategory: dCat,
      bodyCategory: c.category,
      rationale: `${c.family} — ${c.note}.`,
      moods: c.moods,
      score,
      reasons,
      curated: false,
    });
  });

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

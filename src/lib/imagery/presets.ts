/**
 * Static vocabularies for the Imagery lab: purpose presets, style suggestion
 * chips, platform sizes and one-click style starters. Pure data — no DOM, no React.
 */
import type { ImageryStyle } from "@/lib/genome/schema";
import type { CompiledPrompt, ImagePurpose } from "./prompt-compiler";

export type Aspect = CompiledPrompt["aspectHint"];

export interface PurposePreset {
  id: ImagePurpose;
  label: string;
  description: string;
  /** Default aspect — mirrors the compiler's aspectHint so the UI can explain it. */
  aspect: Aspect;
  /** Example subjects, shown as one-click fills. */
  examples: string[];
}

export const PURPOSES: PurposePreset[] = [
  {
    id: "hero",
    label: "Hero image",
    description: "Wide editorial visual for a site or campaign header, with room for a headline.",
    aspect: "16:9",
    examples: ["a wide landscape at dawn with low mist and a single distant figure", "a studio still life with generous empty space to the left"],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    description: "Candid, human moments that show the brand in use.",
    aspect: "3:2",
    examples: ["friends sharing a meal by a window in soft daylight", "hands holding the product on a worn wooden table"],
  },
  {
    id: "product",
    label: "Product",
    description: "Clean studio shots of a product, packaging or object.",
    aspect: "1:1",
    examples: ["the product on a stone plinth against a seamless backdrop", "packaging arranged in a tidy grid on linen"],
  },
  {
    id: "social",
    label: "Social post",
    description: "Bold, single-focus visuals for feeds and stories.",
    aspect: "1:1",
    examples: ["a close-up detail with a strong diagonal", "a single bold object on a flat colour field"],
  },
  {
    id: "illustration",
    label: "Illustration",
    description: "Spot and editorial illustrations in one consistent style.",
    aspect: "4:3",
    examples: ["a city skyline at night built from simple shapes", "a plant growing out of a stack of books"],
  },
  {
    id: "pattern",
    label: "Pattern",
    description: "Seamless, tileable surface patterns for packaging and backgrounds.",
    aspect: "1:1",
    examples: ["thin lines and small leaves", "geometric arcs and dots"],
  },
  {
    id: "texture",
    label: "Texture",
    description: "Abstract backgrounds for sections, decks and print.",
    aspect: "16:9",
    examples: ["hand-made paper grain", "brushed metal with soft directional light"],
  },
  {
    id: "icon",
    label: "Icon",
    description: "Simple flat icons with a consistent stroke and geometry.",
    aspect: "1:1",
    examples: ["a paper plane", "a cup with a single curl of steam"],
  },
  {
    id: "logo-concept",
    label: "Logo concept",
    description: "Flat mark explorations to vectorise in the Logo lab.",
    aspect: "1:1",
    examples: ["an abstract arc over concentric rings", "a monogram built from two overlapping circles"],
  },
  {
    id: "moodboard",
    label: "Moodboard tile",
    description: "Evocative, atmospheric tiles for direction and pitching.",
    aspect: "1:1",
    examples: ["fog over a dark shoreline", "a close-up of glazed ceramic in low sun"],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your subject plus the brand style — no purpose template.",
    aspect: "1:1",
    examples: ["the workshop interior at night, lit by a single lamp"],
  },
];

export const PURPOSE_BY_ID = Object.fromEntries(PURPOSES.map((p) => [p.id, p])) as Record<ImagePurpose, PurposePreset>;
export const PURPOSE_IDS = new Set<string>(PURPOSES.map((p) => p.id));

export const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "1:1", label: "Square" },
  { id: "16:9", label: "Wide" },
  { id: "3:2", label: "Photo" },
  { id: "4:3", label: "Standard" },
  { id: "3:4", label: "Portrait" },
  { id: "9:16", label: "Tall" },
];

export interface PlatformPreset {
  id: string;
  platform: string;
  label: string;
  width: number;
  height: number;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "instagram-post", platform: "Instagram", label: "Post", width: 1080, height: 1080 },
  { id: "instagram-story", platform: "Instagram", label: "Story", width: 1080, height: 1920 },
  { id: "linkedin-banner", platform: "LinkedIn", label: "Banner", width: 1584, height: 396 },
  { id: "x-header", platform: "X", label: "Header", width: 1500, height: 500 },
  { id: "youtube-thumbnail", platform: "YouTube", label: "Thumbnail", width: 1280, height: 720 },
  { id: "og-image", platform: "Web", label: "OG image", width: 1200, height: 630 },
];

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORM_PRESETS.map((p) => [p.id, p])) as Record<string, PlatformPreset>;

/** Suggestion chips for the Style form. Phrases are short so they compose into one prompt sentence. */
export const STYLE_VOCAB = {
  medium: [
    "Editorial photography",
    "35mm film photography",
    "Studio product photography",
    "Cinematic still",
    "Macro photography",
    "Flat vector illustration",
    "Isometric illustration",
    "Risograph print",
    "Watercolour",
    "Ink line art",
    "Paper cut-out collage",
    "Soft clay 3D render",
  ],
  lighting: [
    "Soft natural window light",
    "Golden hour backlight",
    "Blue hour",
    "Overcast, diffuse",
    "Hard studio flash",
    "Rim light on dark",
    "Candle and ember glow",
    "High-key, bright",
    "Low-key, moody",
    "Neon reflections",
  ],
  composition: [
    "Generous negative space",
    "Centered subject",
    "Rule of thirds",
    "Low horizon, wide sky",
    "Top-down flat lay",
    "Tight crop on detail",
    "Symmetry",
    "Leading lines",
    "Layered foreground",
    "Off-center with copy space",
  ],
  colorTreatment: [
    "Muted, desaturated",
    "Warm film grade",
    "Cool shadows, warm highlights",
    "High-contrast black and white",
    "Duotone in brand colours",
    "Pastel, airy",
    "Rich, saturated",
    "Matte, lifted blacks",
    "Monochrome palette",
    "Faded vintage",
  ],
  subjects: [
    "hands at work",
    "materials and textures",
    "the place before the product",
    "tools of the craft",
    "people in real settings",
    "details and close-ups",
  ],
  mood: ["quiet", "warm", "precise", "playful", "bold", "expansive", "intimate", "optimistic", "serene", "raw", "luxurious", "honest", "energetic", "nostalgic", "minimal"],
  avoid: ["text", "watermarks", "stock-photo smiles", "neon", "clutter", "HDR look", "lens flare", "oversaturation", "3D render look", "generic AI sheen", "collage grids", "faces"],
} as const;

export interface StyleStarter {
  id: string;
  label: string;
  description: string;
  style: Partial<Pick<ImageryStyle, "medium" | "lighting" | "composition" | "colorTreatment" | "mood" | "avoid">>;
}

/** One-click starting points for an empty imagery style. */
export const STYLE_STARTERS: StyleStarter[] = [
  {
    id: "editorial-film",
    label: "Editorial film",
    description: "Matte photography, natural light, lots of air.",
    style: {
      medium: "Editorial photography with a matte film look",
      lighting: "Soft natural light, long shadows",
      composition: "Generous negative space, subject low in frame",
      colorTreatment: "Muted saturation, warm highlights, cool shadows",
      mood: ["quiet", "warm", "honest"],
      avoid: ["stock-photo smiles", "HDR look", "neon"],
    },
  },
  {
    id: "studio-minimal",
    label: "Studio minimal",
    description: "Clean product photography on seamless backdrops.",
    style: {
      medium: "Studio product photography",
      lighting: "Soft diffused key light, gentle gradient backdrop",
      composition: "Centered subject, tight crop, clean geometry",
      colorTreatment: "Neutral, accurate colour, matte finish",
      mood: ["precise", "calm", "premium"],
      avoid: ["clutter", "props", "lens flare"],
    },
  },
  {
    id: "flat-illustration",
    label: "Flat illustration",
    description: "Vector shapes, limited palette, consistent line.",
    style: {
      medium: "Flat vector illustration with simple geometric shapes",
      lighting: "Flat, no shading",
      composition: "Centered composition with generous margins",
      colorTreatment: "Limited palette drawn from the brand colours",
      mood: ["playful", "clear", "friendly"],
      avoid: ["gradients", "photo realism", "3D render look", "text"],
    },
  },
  {
    id: "cinematic-dark",
    label: "Cinematic dark",
    description: "Moody stills, rim light, deep shadows.",
    style: {
      medium: "Cinematic still with an anamorphic feel",
      lighting: "Low-key, rim light on dark, practical light sources",
      composition: "Wide frame, layered foreground, off-center subject",
      colorTreatment: "Deep blacks, teal and amber grade",
      mood: ["bold", "intimate", "dramatic"],
      avoid: ["oversaturation", "flat lighting", "text"],
    },
  },
];

/** True when no field of the imagery style has been filled in yet. */
export function imageryStyleIsEmpty(s: ImageryStyle): boolean {
  return !s.medium && !s.lighting && !s.composition && !s.colorTreatment && !s.subjects && !s.mood.length && !s.avoid.length && !s.promptSuffix && !s.guidance;
}

/** Default sample subject for the compiled-prompt preview. */
export function sampleSubjectFor(purpose: ImagePurpose): string {
  return PURPOSE_BY_ID[purpose].examples[0] ?? "the product";
}

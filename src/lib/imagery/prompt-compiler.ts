/**
 * The Prompt Compiler turns a Brand Genome + an intent into a prompt that keeps
 * generated media on-brand, whichever model renders it. This is the layer most
 * "AI design tools" are missing: the brand is compiled into every request.
 */
import type { Genome } from "@/lib/genome/schema";

export type ImagePurpose =
  | "logo-concept"
  | "icon"
  | "hero"
  | "lifestyle"
  | "product"
  | "pattern"
  | "texture"
  | "social"
  | "illustration"
  | "moodboard"
  | "custom";

export interface CompileInput {
  genome: Genome | null;
  subject: string;
  purpose: ImagePurpose;
  /** Extra free-text from the user */
  extra?: string;
  /** Whether the model handles negative prompts natively */
  negativeSupported?: boolean;
  /** Include hex codes? Some models respond well to them (FLUX), others ignore */
  includeHex?: boolean;
}

export interface CompiledPrompt {
  prompt: string;
  negativePrompt: string;
  /** Human-readable explanation of what was injected and why */
  notes: string[];
  aspectHint: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2";
}

const PURPOSE_TEMPLATES: Record<ImagePurpose, { lead: string; tail: string; aspect: CompiledPrompt["aspectHint"]; negatives: string[] }> = {
  "logo-concept": {
    lead: "Flat vector logo mark",
    tail: "minimal geometric construction, single solid color on a plain white background, centered, no text, no letters, no mockup, no shading, no gradients, crisp edges, professional brand identity design",
    aspect: "1:1",
    negatives: ["text", "letters", "watermark", "photo", "3d render", "gradient", "shadow", "mockup", "multiple logos"],
  },
  icon: {
    lead: "Simple icon",
    tail: "consistent stroke weight, flat vector style, plain white background, centered, no text",
    aspect: "1:1",
    negatives: ["text", "photo", "3d", "shadow", "gradient"],
  },
  hero: {
    lead: "Brand hero image",
    tail: "editorial quality, generous negative space for headline copy, no text, no logos",
    aspect: "16:9",
    negatives: ["text", "watermark", "logo", "low quality", "blurry"],
  },
  lifestyle: {
    lead: "Lifestyle photograph",
    tail: "natural, candid, authentic moment, no text, no logos",
    aspect: "3:2",
    negatives: ["text", "watermark", "logo", "stock photo pose", "oversaturated"],
  },
  product: {
    lead: "Product photograph",
    tail: "studio quality, clean composition, no text, no logos",
    aspect: "1:1",
    negatives: ["text", "watermark", "clutter", "blurry"],
  },
  pattern: {
    lead: "Seamless repeating pattern",
    tail: "flat vector style, tileable, evenly distributed, no text",
    aspect: "1:1",
    negatives: ["text", "photo", "3d", "border", "frame"],
  },
  texture: {
    lead: "Background texture",
    tail: "subtle, abstract, suitable as a brand background, no text, no objects",
    aspect: "16:9",
    negatives: ["text", "objects", "faces", "logo"],
  },
  social: {
    lead: "Social media visual",
    tail: "bold composition, clear focal point, room for a short caption, no text",
    aspect: "1:1",
    negatives: ["text", "watermark", "logo", "clutter"],
  },
  illustration: {
    lead: "Brand illustration",
    tail: "consistent illustration style, clean shapes, no text",
    aspect: "4:3",
    negatives: ["text", "photo", "watermark"],
  },
  moodboard: {
    lead: "Moodboard tile",
    tail: "evocative, atmospheric, no text",
    aspect: "1:1",
    negatives: ["text", "watermark", "collage grid"],
  },
  custom: { lead: "", tail: "", aspect: "1:1", negatives: ["text", "watermark"] },
};

function colorPhrase(g: Genome, includeHex: boolean): string | null {
  const cs = g.visual.palette.colors;
  if (!cs.length) return null;
  const roles = ["primary", "secondary", "accent", "background"];
  const picked = [...cs].sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role)).slice(0, 4);
  const parts = picked.map((c) => (includeHex ? `${c.name.toLowerCase()} (${c.hex})` : c.name.toLowerCase()));
  return `brand color palette of ${parts.join(", ")}`;
}

export function compilePrompt(input: CompileInput): CompiledPrompt {
  const { genome: g, subject, purpose, extra = "", negativeSupported = false, includeHex = true } = input;
  const t = PURPOSE_TEMPLATES[purpose];
  const notes: string[] = [];
  const parts: string[] = [];

  if (t.lead) parts.push(`${t.lead}: ${subject.trim()}`);
  else parts.push(subject.trim());

  if (g) {
    const im = g.visual.imagery;
    const isVector = purpose === "logo-concept" || purpose === "icon" || purpose === "pattern";
    if (!isVector) {
      const style = [im.medium, im.lighting, im.composition, im.colorTreatment].filter(Boolean).join(", ");
      if (style) {
        parts.push(style);
        notes.push("Imagery style from Genome");
      }
      if (im.mood.length) {
        parts.push(`mood: ${im.mood.join(", ")}`);
        notes.push("Mood keywords from Genome");
      }
    } else {
      const el = g.visual.elements;
      if (el.shapes.length) {
        parts.push(`inspired by ${el.shapes.slice(0, 3).join(", ").toLowerCase()}`);
        notes.push("Shape language from Genome");
      }
      if (g.visual.logo.concept && purpose === "logo-concept") {
        parts.push(`concept: ${g.visual.logo.concept}`);
        notes.push("Logo concept from Genome");
      }
    }
    const cp = colorPhrase(g, includeHex && !isVector ? true : purpose !== "logo-concept");
    if (cp) {
      parts.push(cp);
      notes.push("Palette injected");
    }
    const traits = g.strategy.personality
      .filter((a) => Math.abs(a.value - 50) >= 20)
      .map((a) => (a.value > 50 ? a.right : a.left).toLowerCase());
    if (traits.length) {
      parts.push(`personality: ${traits.join(", ")}`);
      notes.push("Personality traits from Genome");
    }
    if (g.strategy.keywords.length && !isVector) {
      parts.push(`evokes ${g.strategy.keywords.slice(0, 4).join(", ")}`);
    }
    if (im.promptSuffix) parts.push(im.promptSuffix);
  }

  if (t.tail) parts.push(t.tail);
  if (extra.trim()) parts.push(extra.trim());

  const negatives = [...t.negatives, ...(g?.visual.imagery.avoid ?? [])];
  const negativePrompt = Array.from(new Set(negatives)).join(", ");

  let prompt = parts.filter(Boolean).join(". ").replace(/\.\./g, ".");
  if (!negativeSupported && negatives.length) {
    // Models without negative prompts still respond to explicit exclusions.
    const avoid = (g?.visual.imagery.avoid ?? []).slice(0, 4);
    if (avoid.length) prompt += `. Avoid: ${avoid.join(", ")}`;
  }

  return { prompt, negativePrompt, notes, aspectHint: t.aspect };
}

export function aspectToSize(aspect: CompiledPrompt["aspectHint"] | string, base = 1024): { width: number; height: number } {
  const map: Record<string, [number, number]> = {
    "1:1": [1, 1],
    "16:9": [16, 9],
    "9:16": [9, 16],
    "4:3": [4, 3],
    "3:4": [3, 4],
    "3:2": [3, 2],
    "2:3": [2, 3],
  };
  const [w, h] = map[aspect] ?? [1, 1];
  const scale = base / Math.max(w, h);
  const round16 = (n: number) => Math.round((n * scale) / 16) * 16;
  return { width: round16(w), height: round16(h) };
}

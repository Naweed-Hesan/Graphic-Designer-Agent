/**
 * The Brand Genome — Ligature's single source of truth.
 *
 * Every lab reads from and writes to this document. The AI Creative Director
 * edits it through typed tools. Exports (tokens, guidelines, kits) are derived
 * from it. Keep it serialisable, versioned and boring.
 */
import { z } from "zod";

export const HEX = /^#[0-9a-fA-F]{6}$/;

export const StageId = z.enum([
  "brief",
  "strategy",
  "logo",
  "color",
  "type",
  "imagery",
  "motion",
  "mockups",
  "guidelines",
  "export",
]);
export type StageId = z.infer<typeof StageId>;

export const StageStatus = z.enum(["todo", "in-progress", "done"]);
export type StageStatus = z.infer<typeof StageStatus>;

export const ColorRole = z.enum([
  "primary",
  "secondary",
  "accent",
  "neutral",
  "background",
  "surface",
  "text",
  "success",
  "warning",
  "error",
  "custom",
]);
export type ColorRole = z.infer<typeof ColorRole>;

export const BrandColor = z.object({
  id: z.string(),
  name: z.string(),
  hex: z.string().regex(HEX),
  role: ColorRole.default("custom"),
  usage: z.string().default(""),
  locked: z.boolean().default(false),
});
export type BrandColor = z.infer<typeof BrandColor>;

export const FontCategory = z.enum(["serif", "sans-serif", "display", "handwriting", "monospace"]);
export type FontCategory = z.infer<typeof FontCategory>;

export const FontSpec = z.object({
  family: z.string().default("Inter"),
  source: z.enum(["google", "system", "custom"]).default("google"),
  category: FontCategory.default("sans-serif"),
  weights: z.array(z.number()).default([400, 700]),
  fallback: z.string().default("sans-serif"),
  variable: z.boolean().default(false),
  /** Optional asset id for a custom font file. */
  assetId: z.string().optional(),
});
export type FontSpec = z.infer<typeof FontSpec>;

export const TypeStyle = z.object({
  id: z.string(),
  name: z.string(),
  font: z.enum(["display", "body", "mono"]).default("body"),
  size: z.number(),
  weight: z.number().default(400),
  lineHeight: z.number().default(1.4),
  letterSpacing: z.number().default(0),
  transform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
});
export type TypeStyle = z.infer<typeof TypeStyle>;

export const Typography = z.object({
  display: FontSpec.prefault({ family: "Instrument Serif", category: "serif", weights: [400], fallback: "serif" }),
  body: FontSpec.prefault({ family: "Inter", category: "sans-serif", weights: [400, 500, 700], fallback: "sans-serif" }),
  mono: FontSpec.prefault({ family: "JetBrains Mono", category: "monospace", weights: [400], fallback: "monospace" }),
  scale: z
    .object({ base: z.number().default(16), ratio: z.number().default(1.25) })
    .default({ base: 16, ratio: 1.25 }),
  styles: z.array(TypeStyle).default([]),
  rationale: z.string().default(""),
});
export type Typography = z.infer<typeof Typography>;

export const PersonalityAxis = z.object({
  id: z.string(),
  left: z.string(),
  right: z.string(),
  /** 0 = fully left, 100 = fully right */
  value: z.number().min(0).max(100),
});
export type PersonalityAxis = z.infer<typeof PersonalityAxis>;

export const Archetype = z.enum([
  "",
  "innocent",
  "everyman",
  "hero",
  "outlaw",
  "explorer",
  "creator",
  "ruler",
  "magician",
  "lover",
  "caregiver",
  "jester",
  "sage",
]);
export type Archetype = z.infer<typeof Archetype>;

export const Brief = z.object({
  clientName: z.string().default(""),
  projectName: z.string().default(""),
  industry: z.string().default(""),
  description: z.string().default(""),
  goals: z.string().default(""),
  audience: z.string().default(""),
  deliverables: z.array(z.string()).default([]),
  timeline: z.string().default(""),
  constraints: z.string().default(""),
  references: z.string().default(""),
  competitors: z.array(z.object({ name: z.string(), note: z.string().default("") })).default([]),
});
export type Brief = z.infer<typeof Brief>;

export const Strategy = z.object({
  positioning: z.string().default(""),
  mission: z.string().default(""),
  vision: z.string().default(""),
  values: z.array(z.string()).default([]),
  archetype: Archetype.default(""),
  secondaryArchetype: Archetype.default(""),
  personality: z.array(PersonalityAxis).default([]),
  tagline: z.string().default(""),
  taglineOptions: z.array(z.string()).default([]),
  tone: z
    .object({
      voice: z.string().default(""),
      dos: z.array(z.string()).default([]),
      donts: z.array(z.string()).default([]),
      sample: z.string().default(""),
    })
    .default({ voice: "", dos: [], donts: [], sample: "" }),
  keywords: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  nameOptions: z.array(z.string()).default([]),
});
export type Strategy = z.infer<typeof Strategy>;

export const LogoVariantKey = z.enum([
  "primary",
  "mark",
  "wordmark",
  "horizontal",
  "stacked",
  "mono-dark",
  "mono-light",
  "favicon",
]);
export type LogoVariantKey = z.infer<typeof LogoVariantKey>;

export const LogoSystem = z.object({
  /** Asset ids for AI-generated concept explorations */
  concepts: z.array(z.string()).default([]),
  /** Asset id of the chosen mark (SVG) */
  markAssetId: z.string().optional(),
  /** Asset id of the wordmark (SVG) */
  wordmarkAssetId: z.string().optional(),
  wordmarkText: z.string().default(""),
  wordmarkFont: z.enum(["display", "body", "mono"]).default("display"),
  wordmarkWeight: z.number().default(700),
  wordmarkTracking: z.number().default(0),
  wordmarkCase: z.enum(["none", "uppercase", "lowercase"]).default("none"),
  /** Named variants → asset ids (SVG) */
  variants: z.record(z.string(), z.string()).default({}),
  clearspaceMultiplier: z.number().default(1),
  minSizePx: z.number().default(24),
  minSizeMm: z.number().default(10),
  usageRules: z.array(z.string()).default([]),
  doNots: z.array(z.string()).default([]),
  concept: z.string().default(""),
});
export type LogoSystem = z.infer<typeof LogoSystem>;

export const ImageryStyle = z.object({
  medium: z.string().default(""),
  lighting: z.string().default(""),
  composition: z.string().default(""),
  colorTreatment: z.string().default(""),
  subjects: z.string().default(""),
  mood: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  promptSuffix: z.string().default(""),
  referenceAssetIds: z.array(z.string()).default([]),
  guidance: z.string().default(""),
});
export type ImageryStyle = z.infer<typeof ImageryStyle>;

export const GraphicElements = z.object({
  shapes: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
  iconStyle: z
    .object({
      style: z.enum(["outline", "filled", "duotone"]).default("outline"),
      strokeWidth: z.number().default(1.5),
      cornerRadius: z.number().default(2),
    })
    .default({ style: "outline", strokeWidth: 1.5, cornerRadius: 2 }),
  notes: z.string().default(""),
});
export type GraphicElements = z.infer<typeof GraphicElements>;

export const MotionSystem = z.object({
  easing: z.string().default("cubic-bezier(0.2, 0.8, 0.2, 1)"),
  durationBase: z.number().default(400),
  principles: z.array(z.string()).default([]),
  preset: z.string().default("reveal-scale"),
  notes: z.string().default(""),
});
export type MotionSystem = z.infer<typeof MotionSystem>;

export const Palette = z.object({
  colors: z.array(BrandColor).default([]),
  rationale: z.string().default(""),
  /** Optional dark-mode overrides keyed by color id */
  dark: z.record(z.string(), z.string().regex(HEX)).default({}),
});
export type Palette = z.infer<typeof Palette>;

export const Visual = z.object({
  palette: Palette.default({ colors: [], rationale: "", dark: {} }),
  typography: Typography.prefault({}),
  logo: LogoSystem.prefault({}),
  imagery: ImageryStyle.prefault({}),
  elements: GraphicElements.prefault({}),
  motion: MotionSystem.prefault({}),
});
export type Visual = z.infer<typeof Visual>;

export const HistoryEntry = z.object({
  id: z.string(),
  ts: z.number(),
  actor: z.enum(["user", "ai", "system"]),
  summary: z.string(),
  stage: StageId.optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const Genome = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string(),
  name: z.string().default("Untitled brand"),
  createdAt: z.number(),
  updatedAt: z.number(),
  brief: Brief.prefault({}),
  strategy: Strategy.prefault({}),
  visual: Visual.prefault({}),
  stages: z.partialRecord(StageId, StageStatus).default({}),
  history: z.array(HistoryEntry).default([]),
  notes: z.string().default(""),
});
export type Genome = z.infer<typeof Genome>;

/** Parse anything into a valid genome, filling defaults. Throws on hard errors. */
export function parseGenome(input: unknown): Genome {
  return Genome.parse(input);
}

export function safeParseGenome(input: unknown): { ok: true; genome: Genome } | { ok: false; error: string } {
  const r = Genome.safeParse(input);
  if (r.success) return { ok: true, genome: r.data };
  return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}

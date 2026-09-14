/**
 * Creative Director tools. One definition serves both the Claude Agent SDK
 * (in-process MCP server) and OpenAI-compatible function calling.
 */
import { z } from "zod";
import { Genome as GenomeSchema, type Genome, BrandColor, ColorRole, StageId, StageStatus, HEX } from "@/lib/genome/schema";
import { applyOperations, isSafePath } from "@/lib/genome/paths";
import { compilePrompt, aspectToSize, type ImagePurpose } from "@/lib/imagery/prompt-compiler";
import { contrastReport } from "@/lib/color/contrast";
import { generateImageWithFallback } from "@/lib/providers/image";
import type { ProviderSettings } from "@/lib/providers/types";
import type { ChatEvent } from "./events";

export interface ToolContext {
  genome: Genome;
  assets: { id: string; name: string; kind: string; stage: string; prompt?: string }[];
  settings: ProviderSettings;
  stage?: string;
  emit: (e: ChatEvent) => void;
  signal?: AbortSignal;
}

export interface ToolDef<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  shape: S;
  run: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<string>;
  readOnly?: boolean;
}

function def<S extends z.ZodRawShape>(t: ToolDef<S>): ToolDef<z.ZodRawShape> {
  return t as unknown as ToolDef<z.ZodRawShape>;
}

const PURPOSES = ["logo-concept", "icon", "hero", "lifestyle", "product", "pattern", "texture", "social", "illustration", "moodboard", "custom"] as const;

function compactGenome(g: Genome) {
  const { history: _h, ...rest } = g;
  void _h;
  return rest;
}

function commit(ctx: ToolContext, next: Genome, ops: { path: string; value: unknown }[], summary: string): string {
  const parsed = GenomeSchema.safeParse(next);
  if (!parsed.success) {
    return `Rejected: the change would make the Genome invalid — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
  }
  ctx.genome = parsed.data;
  ctx.emit({ type: "genome-ops", ops, summary });
  return `Applied: ${summary}`;
}

export const TOOLS: ToolDef[] = [
  def({
    name: "get_genome",
    description: "Read the current Brand Genome (brief, strategy, visual system, stage status). Call this before proposing changes.",
    shape: { section: z.enum(["all", "brief", "strategy", "visual", "stages"]).default("all").describe("Which section to return") },
    readOnly: true,
    run: async ({ section }, ctx) => {
      const g = compactGenome(ctx.genome);
      const out = section === "all" ? g : section === "visual" ? g.visual : section === "stages" ? g.stages : g[section];
      return JSON.stringify(out);
    },
  }),
  def({
    name: "update_genome",
    description:
      "Set values in the Brand Genome by dot-path. Use for text fields and lists, e.g. {path:'strategy.tagline', value:'...'} or {path:'visual.imagery.mood', value:['quiet','warm']}. For colors use set_palette; for fonts use set_typography.",
    shape: {
      operations: z.array(z.object({ path: z.string().describe("Dot path like strategy.values or visual.logo.concept"), value: z.unknown().describe("JSON value to set") })).min(1),
      summary: z.string().describe("One line describing the change for the project history"),
    },
    run: async ({ operations, summary }, ctx) => {
      const blocked = operations.find((o) => /^(id|createdAt|schemaVersion|history)$/.test(o.path.split(".")[0]));
      if (blocked) return `Rejected: ${blocked.path} is read-only.`;
      const unsafe = operations.find((o) => !isSafePath(o.path));
      if (unsafe) return `Rejected: "${unsafe.path}" is not a valid Genome path.`;
      const ops = operations.map((o) => ({ path: o.path, value: o.value }));
      const next = applyOperations(ctx.genome, ops);
      return commit(ctx, next, ops, summary);
    },
  }),
  def({
    name: "set_palette",
    description: "Replace the brand color palette. Provide 4–8 colors with roles (primary, secondary, accent, neutral, background, surface, text). Include a one-paragraph rationale.",
    shape: {
      colors: z.array(z.object({ name: z.string(), hex: z.string().regex(HEX, "6-digit hex like #0F7B6C"), role: ColorRole, usage: z.string().default("") })).min(2).max(12),
      rationale: z.string().default(""),
    },
    run: async ({ colors, rationale }, ctx) => {
      const existing = ctx.genome.visual.palette.colors;
      const next = structuredClone(ctx.genome);
      next.visual.palette.colors = colors.map((c, i) => {
        const prev = existing.find((e) => e.name.toLowerCase() === c.name.toLowerCase() || e.hex.toLowerCase() === c.hex.toLowerCase());
        return BrandColor.parse({ id: prev?.id ?? `c${Date.now().toString(36)}${i}`, name: c.name, hex: c.hex.toUpperCase(), role: c.role, usage: c.usage, locked: prev?.locked ?? false });
      });
      next.visual.palette.rationale = rationale || next.visual.palette.rationale;
      const ops = [
        { path: "visual.palette.colors", value: next.visual.palette.colors },
        { path: "visual.palette.rationale", value: next.visual.palette.rationale },
      ];
      const report = next.visual.palette.colors
        .filter((c) => c.role === "primary" || c.role === "secondary" || c.role === "accent")
        .map((c) => {
          const bg = next.visual.palette.colors.find((b) => b.role === "background")?.hex ?? "#FFFFFF";
          const r = contrastReport(c.hex, bg);
          return `${c.name} on background: ${r.ratio}:1 (${r.aaNormal ? "AA" : r.aaLarge ? "AA large only" : "fails AA"})`;
        })
        .join("; ");
      return `${commit(ctx, next, ops, `Palette set: ${colors.map((c) => c.name).join(", ")}`)}. Contrast: ${report || "n/a"}`;
    },
  }),
  def({
    name: "set_typography",
    description: "Set the display and/or body typeface (Google Fonts family names), the modular scale ratio, and a rationale.",
    shape: {
      display: z.object({ family: z.string(), category: z.enum(["serif", "sans-serif", "display", "handwriting", "monospace"]).default("serif"), weights: z.array(z.number()).default([400, 700]) }).optional(),
      body: z.object({ family: z.string(), category: z.enum(["serif", "sans-serif", "display", "handwriting", "monospace"]).default("sans-serif"), weights: z.array(z.number()).default([400, 500, 700]) }).optional(),
      ratio: z.number().min(1.05).max(1.8).optional(),
      rationale: z.string().optional(),
    },
    run: async ({ display, body, ratio, rationale }, ctx) => {
      const next = structuredClone(ctx.genome);
      const ops: { path: string; value: unknown }[] = [];
      if (display) {
        next.visual.typography.display = { ...next.visual.typography.display, family: display.family, category: display.category, weights: display.weights, source: "google", fallback: display.category === "serif" ? "serif" : "sans-serif" };
        ops.push({ path: "visual.typography.display", value: next.visual.typography.display });
      }
      if (body) {
        next.visual.typography.body = { ...next.visual.typography.body, family: body.family, category: body.category, weights: body.weights, source: "google", fallback: body.category === "serif" ? "serif" : "sans-serif" };
        ops.push({ path: "visual.typography.body", value: next.visual.typography.body });
      }
      if (ratio) {
        next.visual.typography.scale.ratio = ratio;
        ops.push({ path: "visual.typography.scale.ratio", value: ratio });
      }
      if (rationale) {
        next.visual.typography.rationale = rationale;
        ops.push({ path: "visual.typography.rationale", value: rationale });
      }
      if (!ops.length) return "Nothing to change.";
      return commit(ctx, next, ops, `Typography: ${[display?.family, body?.family].filter(Boolean).join(" + ")}${ratio ? ` @ ${ratio}` : ""}`);
    },
  }),
  def({
    name: "compile_prompt",
    description: "Preview the brand-conditioned image prompt Ligature would send for a subject and purpose, without generating.",
    shape: { subject: z.string(), purpose: z.enum(PURPOSES).default("hero") },
    readOnly: true,
    run: async ({ subject, purpose }, ctx) => JSON.stringify(compilePrompt({ genome: ctx.genome, subject, purpose: purpose as ImagePurpose })),
  }),
  def({
    name: "generate_image",
    description: "Generate on-brand images with the configured free providers. The Brand Genome is compiled into the prompt automatically. Returns the asset names saved to the project.",
    shape: {
      subject: z.string().describe("What to depict, in one sentence"),
      purpose: z.enum(PURPOSES).default("hero"),
      aspect: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2"]).optional(),
      count: z.number().int().min(1).max(4).default(1),
      extra: z.string().optional().describe("Extra style direction appended to the prompt"),
    },
    run: async ({ subject, purpose, aspect, count, extra }, ctx) => {
      const compiled = compilePrompt({ genome: ctx.genome, subject, purpose: purpose as ImagePurpose, extra });
      const { width, height } = aspectToSize(aspect ?? compiled.aspectHint);
      const names: string[] = [];
      const errors: string[] = [];
      for (let i = 0; i < count; i++) {
        if (ctx.signal?.aborted) break;
        ctx.emit({ type: "status", message: `Generating image ${i + 1}/${count}…` });
        const r = await generateImageWithFallback({ prompt: compiled.prompt, negativePrompt: compiled.negativePrompt, width, height, purpose }, ctx.settings, "auto", ctx.signal);
        if (r.image) {
          const name = `${purpose}-${subject.slice(0, 32).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${i + 1}`;
          names.push(name);
          const stage = purpose === "logo-concept" || purpose === "icon" ? "logo" : "imagery";
          ctx.emit({
            type: "asset",
            asset: { name, mime: r.image.mime, dataUrl: r.image.dataUrl, kind: "image", prompt: compiled.prompt, provider: r.image.provider, model: r.image.model, stage, width: r.image.width, height: r.image.height, tags: [purpose, "ai"] },
          });
        } else {
          errors.push(r.attempts.map((a) => `${a.provider}: ${a.error}`).join(" | "));
        }
      }
      if (!names.length) return `Image generation failed. ${errors.join("; ")}. Suggest adding a free provider key in Settings.`;
      return `Saved ${names.length} image(s): ${names.join(", ")}. Prompt used: "${compiled.prompt.slice(0, 200)}…"${errors.length ? ` Some failed: ${errors.join("; ")}` : ""}`;
    },
  }),
  def({
    name: "check_contrast",
    description: "Check WCAG 2 contrast ratio and APCA Lc between two hex colors.",
    shape: { foreground: z.string().regex(HEX), background: z.string().regex(HEX) },
    readOnly: true,
    run: async ({ foreground, background }) => JSON.stringify(contrastReport(foreground, background)),
  }),
  def({
    name: "list_assets",
    description: "List the project's saved assets (logos, images, videos) with ids, names and stages.",
    shape: { stage: z.string().optional() },
    readOnly: true,
    run: async ({ stage }, ctx) => JSON.stringify(ctx.assets.filter((a) => !stage || a.stage === stage).slice(0, 100)),
  }),
  def({
    name: "set_stage_status",
    description: "Mark a workflow stage as todo, in-progress or done.",
    shape: { stage: StageId, status: StageStatus },
    run: async ({ stage, status }, ctx) => {
      const next = structuredClone(ctx.genome);
      next.stages[stage] = status;
      return commit(ctx, next, [{ path: `stages.${stage}`, value: status }], `Stage ${stage} → ${status}`);
    },
  }),
];

export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t])) as Record<string, ToolDef>;

export function toolJsonSchema(t: ToolDef): Record<string, unknown> {
  return z.toJSONSchema(z.object(t.shape), { target: "draft-7", unrepresentable: "any", io: "input" }) as Record<string, unknown>;
}

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext, id: string): Promise<string> {
  const t = TOOL_BY_NAME[name];
  if (!t) return `Unknown tool ${name}`;
  const parsed = z.object(t.shape).safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const err = `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
    ctx.emit({ type: "tool-end", id, name, error: err });
    return err;
  }
  try {
    const result = await t.run(parsed.data, ctx);
    ctx.emit({ type: "tool-end", id, name, result: result.length > 600 ? result.slice(0, 600) + "…" : result });
    return result;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    ctx.emit({ type: "tool-end", id, name, error: err });
    return `Tool error: ${err}`;
  }
}

/** A compact snapshot to prepend to user turns so the model doesn't need a tool call for basics. */
export function genomeBrief(g: Genome, stage?: string): string {
  const pal = g.visual.palette.colors.map((c) => `${c.name} ${c.hex} (${c.role})`).join(", ") || "none yet";
  return [
    `[Project: ${g.name}${stage ? ` · designer is on the ${stage} stage` : ""}]`,
    `Client: ${g.brief.clientName || "—"} · Industry: ${g.brief.industry || "—"}`,
    `Positioning: ${g.strategy.positioning || "—"}`,
    `Archetype: ${g.strategy.archetype || "—"} · Values: ${g.strategy.values.join(", ") || "—"} · Tagline: ${g.strategy.tagline || "—"}`,
    `Palette: ${pal}`,
    `Type: ${g.visual.typography.display.family} / ${g.visual.typography.body.family}`,
    `Stages: ${Object.entries(g.stages).map(([k, v]) => `${k}=${v}`).join(" ")}`,
  ].join("\n");
}

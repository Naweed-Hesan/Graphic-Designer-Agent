import { describe, it, expect } from "vitest";
import { TOOLS, runTool, toolJsonSchema, genomeBrief, type ToolContext } from "../tools";
import { createSampleGenome } from "@/lib/genome/defaults";
import { ProviderSettingsSchema } from "@/lib/providers/types";
import type { ChatEvent } from "../events";

function ctx(): ToolContext & { events: ChatEvent[] } {
  const events: ChatEvent[] = [];
  return { genome: createSampleGenome(), assets: [], settings: ProviderSettingsSchema.parse({}), emit: (e) => events.push(e), events };
}

describe("Creative Director tools", () => {
  it("exposes JSON schemas usable by OpenAI-style function calling", () => {
    for (const t of TOOLS) {
      const s = toolJsonSchema(t) as { type: string; properties: Record<string, unknown> };
      expect(s.type).toBe("object");
      expect(s.properties).toBeDefined();
    }
  });

  it("update_genome applies ops and emits genome-ops", async () => {
    const c = ctx();
    const out = await runTool("update_genome", { operations: [{ path: "strategy.tagline", value: "New line" }], summary: "Tagline" }, c, "t1");
    expect(out).toContain("Applied");
    expect(c.genome.strategy.tagline).toBe("New line");
    expect(c.events.some((e) => e.type === "genome-ops")).toBe(true);
    expect(c.events.some((e) => e.type === "tool-end" && e.name === "update_genome")).toBe(true);
  });

  it("update_genome rejects invalid values and read-only paths", async () => {
    const c = ctx();
    const bad = await runTool("update_genome", { operations: [{ path: "visual.palette.colors.0.hex", value: "nope" }], summary: "x" }, c, "t2");
    expect(bad).toContain("Rejected");
    const ro = await runTool("update_genome", { operations: [{ path: "id", value: "y" }], summary: "x" }, c, "t3");
    expect(ro).toContain("read-only");
  });

  it("set_palette validates hex, keeps ids for matching names, reports contrast", async () => {
    const c = ctx();
    const prevId = c.genome.visual.palette.colors[0].id;
    const out = await runTool("set_palette", { colors: [{ name: "Aurora Teal", hex: "#0f7b6c", role: "primary", usage: "" }, { name: "Paper", hex: "#ffffff", role: "background", usage: "" }], rationale: "r" }, c, "t4");
    expect(out).toContain("Contrast");
    expect(c.genome.visual.palette.colors[0].id).toBe(prevId);
    expect(c.genome.visual.palette.colors[0].hex).toBe("#0F7B6C");
  });

  it("check_contrast and get_genome return JSON", async () => {
    const c = ctx();
    const r = JSON.parse(await runTool("check_contrast", { foreground: "#000000", background: "#ffffff" }, c, "t5"));
    expect(r.aaNormal).toBe(true);
    const g = JSON.parse(await runTool("get_genome", { section: "strategy" }, c, "t6"));
    expect(g.archetype).toBe("explorer");
  });

  it("genome brief is compact and mentions the palette", () => {
    const b = genomeBrief(createSampleGenome(), "color");
    expect(b).toContain("Aurora Roasters");
    expect(b).toContain("#0F7B6C");
    expect(b.length).toBeLessThan(1500);
  });
});

describe("update_genome hardening", () => {
  it("refuses unsafe paths", async () => {
    const c = ctx();
    const out = await runTool("update_genome", { operations: [{ path: "__proto__.owned", value: 1 }], summary: "x" }, c, "t9");
    expect(out).toContain("Rejected");
    expect(({} as Record<string, unknown>).owned).toBeUndefined();
  });
  it("advertises optional parameters as optional in the JSON schema", () => {
    const t = TOOLS.find((x) => x.name === "generate_image")!;
    const schema = toolJsonSchema(t) as { required?: string[] };
    expect(schema.required ?? []).toEqual(["subject"]);
  });
});

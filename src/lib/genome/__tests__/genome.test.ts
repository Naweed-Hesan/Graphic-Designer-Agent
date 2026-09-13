import { describe, it, expect } from "vitest";
import { createGenome, createSampleGenome } from "../defaults";
import { Genome, safeParseGenome } from "../schema";
import { applyOperations, getByPath, setByPath } from "../paths";
import { STAGES, nextStage, prevStage } from "../stages";

describe("Brand Genome", () => {
  it("creates a valid empty genome with every stage set to todo", () => {
    const g = createGenome("Test");
    expect(Genome.safeParse(g).success).toBe(true);
    expect(Object.keys(g.stages)).toHaveLength(STAGES.length);
    expect(g.strategy.personality).toHaveLength(6);
  });

  it("sample genome is fully valid and populated", () => {
    const g = createSampleGenome();
    expect(Genome.safeParse(g).success).toBe(true);
    expect(g.visual.palette.colors.length).toBeGreaterThanOrEqual(5);
    expect(g.strategy.archetype).toBe("explorer");
    expect(g.visual.typography.display.family).toBe("Fraunces");
  });

  it("fills defaults for partial input and rejects bad hex", () => {
    const ok = safeParseGenome({ id: "x", createdAt: 1, updatedAt: 1 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.genome.visual.typography.body.family).toBe("Inter");
    const bad = safeParseGenome({ id: "x", createdAt: 1, updatedAt: 1, visual: { palette: { colors: [{ id: "a", name: "A", hex: "red" }] } } });
    expect(bad.ok).toBe(false);
  });

  it("path helpers set nested values immutably", () => {
    const g = createGenome("Paths");
    const next = setByPath(g, "strategy.tagline", "Hello");
    expect(getByPath(next, "strategy.tagline")).toBe("Hello");
    expect(g.strategy.tagline).toBe("");
    const ops = applyOperations(g, [
      { path: "visual.imagery.mood", value: ["calm"] },
      { path: "stages.brief", value: "done" },
    ]);
    expect(ops.visual.imagery.mood).toEqual(["calm"]);
    expect(ops.stages.brief).toBe("done");
    expect(Genome.safeParse(ops).success).toBe(true);
  });

  it("stage navigation wraps at the ends", () => {
    expect(prevStage("brief")).toBeNull();
    expect(nextStage("export")).toBeNull();
    expect(nextStage("brief")).toBe("strategy");
  });
});

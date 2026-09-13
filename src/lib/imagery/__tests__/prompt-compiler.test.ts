import { describe, it, expect } from "vitest";
import { compilePrompt, aspectToSize } from "../prompt-compiler";
import { createSampleGenome } from "@/lib/genome/defaults";

describe("Prompt Compiler", () => {
  const genome = createSampleGenome();

  it("injects palette, style and personality for a hero image", () => {
    const r = compilePrompt({ genome, subject: "a ceramic cup steaming by a window", purpose: "hero" });
    expect(r.prompt).toContain("Brand hero image");
    expect(r.prompt.toLowerCase()).toContain("aurora teal");
    expect(r.prompt).toContain("#0F7B6C");
    expect(r.prompt).toContain("Editorial photography");
    expect(r.negativePrompt).toContain("latte art");
    expect(r.aspectHint).toBe("16:9");
    expect(r.notes).toContain("Palette injected");
  });

  it("keeps logo concepts flat, textless and shape-led", () => {
    const r = compilePrompt({ genome, subject: "rising sun horizon", purpose: "logo-concept" });
    expect(r.prompt).toContain("Flat vector logo mark");
    expect(r.prompt).toContain("no text");
    expect(r.prompt).toContain("horizon arc");
    expect(r.prompt).not.toContain("Editorial photography");
  });

  it("works without a genome", () => {
    const r = compilePrompt({ genome: null, subject: "abstract waves", purpose: "texture" });
    expect(r.prompt).toContain("abstract waves");
    expect(r.notes).toHaveLength(0);
  });

  it("maps aspect hints to 16-aligned sizes", () => {
    expect(aspectToSize("16:9")).toEqual({ width: 1024, height: 576 });
    expect(aspectToSize("1:1")).toEqual({ width: 1024, height: 1024 });
    expect(aspectToSize("9:16").height).toBe(1024);
  });
});

import { describe, it, expect } from "vitest";
import { paletteToCss, paletteToTailwind, genomeToDtcg, paletteToAse, typographyToCss, hexToCmyk, parseCubicBezier } from "../tokens";
import { createSampleGenome } from "@/lib/genome/defaults";

describe("token exporters", () => {
  const g = createSampleGenome();

  it("emits CSS variables per colour and per role", () => {
    const css = paletteToCss(g);
    expect(css).toContain("--brand-aurora-teal: #0f7b6c;");
    expect(css).toContain("--brand-primary: var(--brand-aurora-teal);");
  });

  it("emits Tailwind v4 and v3 blocks", () => {
    const tw = paletteToTailwind(g);
    expect(tw).toContain("@theme");
    expect(tw).toContain("--color-brand-ember");
    expect(tw).toContain('display: ["Fraunces"');
  });

  it("emits DTCG tokens with a schema and typed values", () => {
    const d = genomeToDtcg(g) as { color: Record<string, { $type: string; $value: string }>; fontSize: Record<string, unknown> };
    expect(d.color["aurora-teal"].$type).toBe("color");
    expect(d.color["aurora-teal"].$value).toBe("#0f7b6c");
    expect(Object.keys(d.fontSize)).toContain("base");
  });

  it("writes a valid ASE header with one block per colour", () => {
    const ase = paletteToAse(g);
    expect(String.fromCharCode(...ase.subarray(0, 4))).toBe("ASEF");
    const blocks = new DataView(ase.buffer).getUint32(8);
    expect(blocks).toBe(g.visual.palette.colors.length + 2);
  });

  it("typography CSS imports Google Fonts and defines the scale", () => {
    const css = typographyToCss(g);
    expect(css).toContain("fonts.googleapis.com/css2?family=Fraunces");
    expect(css).toContain("--text-base: 1.000rem;");
  });

  it("converts to CMYK and parses easing", () => {
    expect(hexToCmyk("#000000")).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(hexToCmyk("#ff0000")).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(parseCubicBezier("cubic-bezier(0.2, 0.8, 0.2, 1)")).toEqual([0.2, 0.8, 0.2, 1]);
    expect(parseCubicBezier("ease")).toEqual([0.2, 0.8, 0.2, 1]);
  });
});

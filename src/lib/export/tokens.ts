/**
 * Design-token exporters derived from the Brand Genome. Pure functions,
 * isomorphic, used by the Color lab, the Export lab and the guidelines.
 */
import type { Genome, BrandColor } from "@/lib/genome/schema";
import { hexToRgb } from "@/lib/color/contrast";
import { slugify } from "@/lib/utils";

export function tokenName(c: BrandColor): string {
  return slugify(c.name) || c.id;
}

export function hexToCmyk(hex: string): { c: number; m: number; y: number; k: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const f = (v: number) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return { c: f(r), m: f(g), y: f(b), k: Math.round(k * 100) };
}

export function paletteToCss(genome: Genome, opts: { selector?: string; prefix?: string } = {}): string {
  const { selector = ":root", prefix = "brand" } = opts;
  const lines = genome.visual.palette.colors.map((c) => `  --${prefix}-${tokenName(c)}: ${c.hex.toLowerCase()};${c.usage ? ` /* ${c.usage} */` : ""}`);
  const roles = genome.visual.palette.colors.filter((c) => c.role !== "custom").map((c) => `  --${prefix}-${c.role}: var(--${prefix}-${tokenName(c)});`);
  const dark = Object.entries(genome.visual.palette.dark);
  let out = `${selector} {\n${lines.join("\n")}\n${roles.length ? roles.join("\n") + "\n" : ""}}\n`;
  if (dark.length) {
    const darkLines = dark
      .map(([id, hex]) => {
        const c = genome.visual.palette.colors.find((x) => x.id === id);
        return c ? `    --${prefix}-${tokenName(c)}: ${hex.toLowerCase()};` : null;
      })
      .filter(Boolean);
    out += `@media (prefers-color-scheme: dark) {\n  ${selector} {\n${darkLines.join("\n")}\n  }\n}\n`;
  }
  return out;
}

export function paletteToScss(genome: Genome, prefix = "brand"): string {
  return genome.visual.palette.colors.map((c) => `$${prefix}-${tokenName(c)}: ${c.hex.toLowerCase()};`).join("\n") + "\n";
}

export function paletteToTailwind(genome: Genome): string {
  const entries = genome.visual.palette.colors.map((c) => `      "${tokenName(c)}": "${c.hex.toLowerCase()}",`).join("\n");
  const v4 = genome.visual.palette.colors.map((c) => `  --color-brand-${tokenName(c)}: ${c.hex.toLowerCase()};`).join("\n");
  return `/* Tailwind v4 — add to your CSS */\n@theme {\n${v4}\n}\n\n/* Tailwind v3 — tailwind.config.js */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        brand: {\n${entries.replace(/^ {6}/gm, "          ")}\n        },\n      },\n      fontFamily: {\n        display: ["${genome.visual.typography.display.family}", "${genome.visual.typography.display.fallback}"],\n        body: ["${genome.visual.typography.body.family}", "${genome.visual.typography.body.fallback}"],\n      },\n    },\n  },\n};\n`;
}

/** W3C Design Tokens Community Group format (2024 draft). */
export function genomeToDtcg(genome: Genome): Record<string, unknown> {
  const color: Record<string, unknown> = {};
  for (const c of genome.visual.palette.colors) {
    color[tokenName(c)] = { $type: "color", $value: c.hex.toLowerCase(), $description: [c.role, c.usage].filter(Boolean).join(" — ") };
  }
  const t = genome.visual.typography;
  const fontFamily = {
    display: { $type: "fontFamily", $value: [t.display.family, t.display.fallback] },
    body: { $type: "fontFamily", $value: [t.body.family, t.body.fallback] },
    mono: { $type: "fontFamily", $value: [t.mono.family, t.mono.fallback] },
  };
  const scale: Record<string, unknown> = {};
  const steps = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
  steps.forEach((name, i) => {
    const exp = i - 2;
    scale[name] = { $type: "dimension", $value: { value: Math.round(t.scale.base * Math.pow(t.scale.ratio, exp) * 100) / 100, unit: "px" } };
  });
  return {
    $schema: "https://tr.designtokens.org/format/",
    brand: { $description: genome.name },
    color,
    fontFamily,
    fontSize: scale,
    motion: {
      easing: { $type: "cubicBezier", $value: parseCubicBezier(genome.visual.motion.easing) },
      duration: { base: { $type: "duration", $value: { value: genome.visual.motion.durationBase, unit: "ms" } } },
    },
  };
}

export function parseCubicBezier(s: string): [number, number, number, number] {
  const m = /cubic-bezier\(([^)]+)\)/.exec(s);
  if (!m) return [0.2, 0.8, 0.2, 1];
  const nums = m[1].split(",").map((x) => parseFloat(x.trim()));
  return nums.length === 4 && nums.every((n) => Number.isFinite(n)) ? (nums as [number, number, number, number]) : [0.2, 0.8, 0.2, 1];
}

/** Tokens Studio (Figma plugin) JSON. */
export function genomeToTokensStudio(genome: Genome): Record<string, unknown> {
  const colors: Record<string, unknown> = {};
  for (const c of genome.visual.palette.colors) colors[tokenName(c)] = { value: c.hex.toLowerCase(), type: "color", description: c.usage };
  const t = genome.visual.typography;
  return {
    global: {
      color: colors,
      fontFamilies: { display: { value: t.display.family, type: "fontFamilies" }, body: { value: t.body.family, type: "fontFamilies" } },
      fontSizes: Object.fromEntries(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"].map((n, i) => [n, { value: `${Math.round(t.scale.base * Math.pow(t.scale.ratio, i - 2))}`, type: "fontSizes" }])),
    },
  };
}

/** Adobe Swatch Exchange (.ase) — RGB swatches, group named after the brand. */
export function paletteToAse(genome: Genome): Uint8Array {
  const colors = genome.visual.palette.colors;
  const enc = (s: string) => {
    const u16 = new Uint8Array((s.length + 1) * 2);
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      u16[i * 2] = code >> 8;
      u16[i * 2 + 1] = code & 0xff;
    }
    return u16;
  };
  const blocks: Uint8Array[] = [];
  const block = (type: number, body: Uint8Array) => {
    const b = new Uint8Array(6 + body.length);
    const dv = new DataView(b.buffer);
    dv.setUint16(0, type);
    dv.setUint32(2, body.length);
    b.set(body, 6);
    blocks.push(b);
  };
  const groupName = enc(genome.name || "Palette");
  const gs = new Uint8Array(2 + groupName.length);
  new DataView(gs.buffer).setUint16(0, groupName.length / 2);
  gs.set(groupName, 2);
  block(0xc001, gs);
  for (const c of colors) {
    const name = enc(`${c.name} ${c.hex.toUpperCase()}`);
    const body = new Uint8Array(2 + name.length + 4 + 12 + 2);
    const dv = new DataView(body.buffer);
    dv.setUint16(0, name.length / 2);
    body.set(name, 2);
    let o = 2 + name.length;
    body.set([0x52, 0x47, 0x42, 0x20], o); // "RGB "
    o += 4;
    const [r, g, b] = hexToRgb(c.hex);
    dv.setFloat32(o, r / 255);
    dv.setFloat32(o + 4, g / 255);
    dv.setFloat32(o + 8, b / 255);
    o += 12;
    dv.setUint16(o, 0); // global
    block(0x0001, body);
  }
  block(0xc002, new Uint8Array(0));
  const total = 12 + blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  out.set([0x41, 0x53, 0x45, 0x46], 0); // ASEF
  dv.setUint16(4, 1);
  dv.setUint16(6, 0);
  dv.setUint32(8, blocks.length);
  let off = 12;
  for (const b of blocks) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}

export function typographyToCss(genome: Genome): string {
  const t = genome.visual.typography;
  const fam = (f: { family: string; weights: number[] }) => `family=${f.family.replace(/\s+/g, "+")}:wght@${[...new Set(f.weights)].sort((a, b) => a - b).join(";")}`;
  const importUrl = `https://fonts.googleapis.com/css2?${[fam(t.display), fam(t.body), fam(t.mono)].join("&")}&display=swap`;
  const steps = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
  const sizes = steps.map((n, i) => `  --text-${n}: ${(Math.round(t.scale.base * Math.pow(t.scale.ratio, i - 2) * 100) / 100 / 16).toFixed(3)}rem;`).join("\n");
  const styles = t.styles
    .map(
      (s) =>
        `.${slugify(s.name)} {\n  font-family: var(--font-${s.font});\n  font-size: ${s.size / 16}rem;\n  font-weight: ${s.weight};\n  line-height: ${s.lineHeight};\n  letter-spacing: ${s.letterSpacing}em;\n  text-transform: ${s.transform};\n}`,
    )
    .join("\n");
  return `@import url("${importUrl}");\n\n:root {\n  --font-display: "${t.display.family}", ${t.display.fallback};\n  --font-body: "${t.body.family}", ${t.body.fallback};\n  --font-mono: "${t.mono.family}", ${t.mono.fallback};\n  --type-base: ${t.scale.base}px;\n  --type-ratio: ${t.scale.ratio};\n${sizes}\n}\n\nbody { font-family: var(--font-body); }\nh1, h2, h3 { font-family: var(--font-display); }\n${styles ? "\n" + styles + "\n" : ""}`;
}

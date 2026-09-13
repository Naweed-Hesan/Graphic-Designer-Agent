/**
 * Palette extraction from pixels: k-means in OKLab on a downsampled sample,
 * deterministic (seeded k-means++), sorted by population.
 */
import { clampChroma, formatHex, type Oklab } from "culori";
import { toOklch, fromOklch } from "./convert";
import type { PaletteSuggestion } from "./harmonies";
import { ROLE_USAGE } from "./harmonies";
import { nameColors } from "./names";

export interface ExtractedColor {
  hex: string;
  /** Fraction of sampled pixels in this cluster, 0..1 */
  share: number;
}

/** Structural subset of `ImageData` so the function is testable without a DOM. */
export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

type Lab = [number, number, number];

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** sRGB 8-bit → OKLab (Björn Ottosson's reference matrices). */
export function rgbToOklab(r8: number, g8: number, b8: number): Lab {
  const r = srgbToLinear(r8);
  const g = srgbToLinear(g8);
  const b = srgbToLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToHex([l, a, b]: Lab): string {
  const col: Oklab = { mode: "oklab", l, a, b };
  return formatHex(clampChroma(col, "oklch")) ?? "#000000";
}

function mulberry32(a: number): () => number {
  let s = a | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (p: Lab, q: Lab) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

export function extractPalette(image: PixelSource, count = 6, opts: { maxSamples?: number; iterations?: number } = {}): ExtractedColor[] {
  const { maxSamples = 4000, iterations = 16 } = opts;
  const { data, width, height } = image;
  const total = Math.min(width * height, Math.floor(data.length / 4));
  if (total === 0 || count < 1) return [];
  const stride = Math.max(1, Math.floor(total / maxSamples));
  const pts: Lab[] = [];
  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    pts.push(rgbToOklab(data[o], data[o + 1], data[o + 2]));
  }
  if (!pts.length) return [];
  const k = Math.min(count, pts.length);
  const rnd = mulberry32(1337);

  // k-means++ seeding
  const centroids: Lab[] = [pts[Math.floor(rnd() * pts.length)]];
  const d2 = new Float64Array(pts.length).fill(Infinity);
  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      d2[i] = Math.min(d2[i], dist2(pts[i], last));
      sum += d2[i];
    }
    if (sum === 0) break;
    let r = rnd() * sum;
    let pick = pts.length - 1;
    for (let i = 0; i < pts.length; i++) {
      r -= d2[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push(pts[pick]);
  }

  // Lloyd iterations
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < iterations; it++) {
    let moved = 0;
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(pts[i], centroids[c]);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (assign[i] !== best) moved++;
      assign[i] = best;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]];
      s[0] += pts[i][0];
      s[1] += pts[i][1];
      s[2] += pts[i][2];
      s[3] += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    }
    if (moved === 0 && it > 0) break;
  }

  // Population per cluster, then merge near-duplicates.
  const counts = new Array<number>(centroids.length).fill(0);
  for (let i = 0; i < pts.length; i++) counts[assign[i]]++;
  const clusters = centroids.map((lab, i) => ({ lab, n: counts[i] })).filter((c) => c.n > 0);
  clusters.sort((a, b) => b.n - a.n);
  const merged: { lab: Lab; n: number }[] = [];
  for (const c of clusters) {
    const near = merged.find((m) => dist2(m.lab, c.lab) < 0.05 * 0.05);
    if (near) {
      const n = near.n + c.n;
      near.lab = [(near.lab[0] * near.n + c.lab[0] * c.n) / n, (near.lab[1] * near.n + c.lab[1] * c.n) / n, (near.lab[2] * near.n + c.lab[2] * c.n) / n];
      near.n = n;
    } else merged.push({ lab: c.lab, n: c.n });
  }
  merged.sort((a, b) => b.n - a.n);
  return merged.slice(0, count).map((c) => ({ hex: labToHex(c.lab), share: c.n / pts.length }));
}

/** Hue histogram (30° bins) weighted by share; only chromatic colours count. */
export function dominantHues(colors: ExtractedColor[], minChroma = 0.04): { hue: number; share: number }[] {
  const bins = new Map<number, number>();
  for (const c of colors) {
    const o = toOklch(c.hex);
    if (o.c < minChroma) continue;
    const bin = Math.floor(((o.h % 360) + 360) % 360 / 30) * 30 + 15;
    bins.set(bin, (bins.get(bin) ?? 0) + c.share);
  }
  return [...bins.entries()].map(([hue, share]) => ({ hue, share })).sort((a, b) => b.share - a.share);
}

/**
 * Turn extracted colours into a role-assigned palette: the lightest becomes
 * the background (or one is synthesised), the darkest the text, the most
 * populous chromatic colours primary/secondary, the most vivid the accent.
 */
export function assignRoles(colors: ExtractedColor[]): PaletteSuggestion[] {
  if (!colors.length) return [];
  const pool = colors.map((c) => ({ ...c, o: toOklch(c.hex) }));
  const take = (pred: (c: (typeof pool)[number]) => boolean, sorter?: (a: (typeof pool)[number], b: (typeof pool)[number]) => number) => {
    const cands = pool.filter(pred);
    if (sorter) cands.sort(sorter);
    const pick = cands[0];
    if (pick) pool.splice(pool.indexOf(pick), 1);
    return pick;
  };
  const bgPick = take((c) => c.o.l > 0.85, (a, b) => b.o.l - a.o.l);
  const textPick = take((c) => c.o.l < 0.32, (a, b) => a.o.l - b.o.l);
  const primaryPick = take((c) => c.o.c > 0.05) ?? take(() => true);
  const accentPick = take((c) => c.o.c > 0.06, (a, b) => b.o.c - a.o.c);
  const secondaryPick = take((c) => c.o.c > 0.04) ?? take(() => true);
  const neutralPick = take(() => true, (a, b) => a.o.c - b.o.c);
  const baseHue = primaryPick?.o.h ?? 0;
  const p = {
    primary: primaryPick?.hex ?? fromOklch({ l: 0.5, c: 0.12, h: baseHue }),
    secondary: secondaryPick?.hex ?? fromOklch({ l: 0.35, c: 0.06, h: baseHue + 30 }),
    accent: accentPick?.hex ?? fromOklch({ l: 0.7, c: 0.15, h: baseHue + 180 }),
    neutral: neutralPick?.hex ?? fromOklch({ l: 0.83, c: 0.02, h: baseHue }),
    background: bgPick?.hex ?? fromOklch({ l: 0.975, c: 0.008, h: baseHue }),
    text: textPick?.hex ?? fromOklch({ l: 0.18, c: 0.02, h: baseHue }),
  };
  const roles = ["primary", "secondary", "accent", "neutral", "background", "text"] as const;
  const names = nameColors(roles.map((r) => p[r]));
  return roles.map((role, i) => ({ role, hex: p[role], name: names[i], usage: ROLE_USAGE[role] }));
}

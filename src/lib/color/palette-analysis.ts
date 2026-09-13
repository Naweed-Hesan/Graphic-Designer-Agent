/**
 * Heuristic palette review: warnings and insights a senior designer would
 * raise when looking at a brand palette. Pure; returns plain messages.
 */
import type { BrandColor } from "../genome/schema";
import { deltaE, hueDistance, isWarmHue, toOklch } from "./convert";
import { wcagRatio } from "./contrast";

export interface PaletteInsight {
  level: "ok" | "warn" | "error";
  message: string;
}

export type AnalyzableColor = Pick<BrandColor, "hex" | "role" | "name">;

export interface PaletteStats {
  count: number;
  averageChroma: number;
  averageLightness: number;
  /** -1 cool … +1 warm, weighted by chroma */
  warmth: number;
  temperature: "warm" | "cool" | "balanced";
  saturatedCount: number;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function paletteStats(colors: AnalyzableColor[]): PaletteStats {
  if (!colors.length) return { count: 0, averageChroma: 0, averageLightness: 0, warmth: 0, temperature: "balanced", saturatedCount: 0 };
  const ok = colors.map((c) => toOklch(c.hex));
  const averageChroma = ok.reduce((s, o) => s + o.c, 0) / ok.length;
  const averageLightness = ok.reduce((s, o) => s + o.l, 0) / ok.length;
  let warm = 0;
  let weight = 0;
  for (const o of ok) {
    if (o.c < 0.02) continue;
    warm += (isWarmHue(o.h) ? 1 : -1) * o.c;
    weight += o.c;
  }
  const warmth = weight ? warm / weight : 0;
  const temperature = warmth > 0.25 ? "warm" : warmth < -0.25 ? "cool" : "balanced";
  return { count: colors.length, averageChroma: round(averageChroma, 3), averageLightness: round(averageLightness, 3), warmth: round(warmth), temperature, saturatedCount: ok.filter((o) => o.c > 0.15).length };
}

export function analyzePalette(colors: AnalyzableColor[]): PaletteInsight[] {
  const out: PaletteInsight[] = [];
  if (!colors.length) return [{ level: "warn", message: "The palette is empty — generate one from a seed or extract it from an image." }];

  const byRole = (role: BrandColor["role"]) => colors.filter((c) => c.role === role);
  const stats = paletteStats(colors);
  const primary = byRole("primary")[0];
  const background = byRole("background")[0];
  const text = byRole("text")[0];
  const accent = byRole("accent")[0];

  if (colors.length > 8) out.push({ level: "warn", message: `${colors.length} colours is a lot — most identities hold at 4–7 so each one has a job.` });
  if (stats.saturatedCount > 3) out.push({ level: "warn", message: `${stats.saturatedCount} highly saturated colours compete for attention. Keep one or two vivid, mute the rest.` });

  if (!primary) out.push({ level: "error", message: "No primary colour. Assign the role so exports and mockups know what leads." });
  if (byRole("primary").length > 1) out.push({ level: "warn", message: "More than one primary — pick one and demote the other to secondary or accent." });
  if (!byRole("neutral").length) out.push({ level: "warn", message: "No neutral. Layouts need a quiet tint for surfaces and dividers." });
  if (!background) out.push({ level: "warn", message: "No background colour. Add one so contrast can be checked against real page colour." });
  if (!text) out.push({ level: "warn", message: "No text colour. Body copy usually deserves its own near-black rather than pure #000." });

  if (text && background) {
    const r = wcagRatio(text.hex, background.hex);
    if (r < 4.5) out.push({ level: "error", message: `${text.name} on ${background.name} is ${r.toFixed(2)}:1 — fails WCAG AA for body text (needs 4.5).` });
    else if (r < 7) out.push({ level: "warn", message: `${text.name} on ${background.name} is ${r.toFixed(2)}:1 — passes AA but not AAA (7:1).` });
    else out.push({ level: "ok", message: `${text.name} on ${background.name} is ${r.toFixed(1)}:1 — comfortably readable.` });
  }
  if (primary && background) {
    const r = wcagRatio(primary.hex, background.hex);
    if (r < 3) out.push({ level: "error", message: `${primary.name} on ${background.name} is ${r.toFixed(2)}:1 — too low even for large text and UI (needs 3).` });
    else if (r < 4.5) out.push({ level: "warn", message: `${primary.name} on ${background.name} is ${r.toFixed(2)}:1 — fine for headlines and buttons, not for small text.` });
  }
  if (accent && primary) {
    const de = deltaE(accent.hex, primary.hex);
    if (de < 0.15) out.push({ level: "warn", message: `${accent.name} barely separates from ${primary.name} (ΔE ${de.toFixed(2)}). Accents should read on top of the primary.` });
  }
  if (text) {
    const l = toOklch(text.hex).l;
    if (l > 0.5) out.push({ level: "warn", message: `${text.name} is light for a text colour — fine for dark mode, weak on paper.` });
  }

  // Near-duplicates and hue crowding among chromatic colours.
  const seen = new Set<string>();
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i];
      const b = colors[j];
      const key = [a.name, b.name].sort().join("|");
      if (seen.has(key)) continue;
      const oa = toOklch(a.hex);
      const ob = toOklch(b.hex);
      const de = deltaE(a.hex, b.hex);
      if (de < 0.02) {
        seen.add(key);
        out.push({ level: "warn", message: `${a.name} and ${b.name} are nearly identical (ΔE ${de.toFixed(2)}). Merge them or push one apart.` });
      } else if (oa.c > 0.06 && ob.c > 0.06 && hueDistance(oa.h, ob.h) < 15 && Math.abs(oa.l - ob.l) < 0.18) {
        seen.add(key);
        out.push({ level: "warn", message: `${a.name} and ${b.name} sit on almost the same hue at similar lightness — they may blur together.` });
      }
    }
  }

  const tempWord = stats.temperature === "warm" ? "Warm palette" : stats.temperature === "cool" ? "Cool palette" : "Balanced temperature";
  const chromaWord = stats.averageChroma < 0.06 ? "muted and restrained" : stats.averageChroma < 0.12 ? "moderate saturation" : "vivid";
  out.push({ level: "ok", message: `${tempWord}, ${chromaWord} (average chroma ${stats.averageChroma.toFixed(3)}).` });

  return out;
}

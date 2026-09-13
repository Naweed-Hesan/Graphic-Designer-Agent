/** Resolve which logo artwork to use anywhere in the studio, with a generated fallback. */
import type { Genome, LogoVariantKey } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { bestTextOn } from "@/lib/color/contrast";

export interface LogoArtwork {
  svg: string;
  source: "variant" | "mark" | "wordmark" | "asset" | "placeholder";
  assetId?: string;
  label: string;
}

export function paletteColor(genome: Genome, role: string, fallback: string): string {
  return genome.visual.palette.colors.find((c) => c.role === role)?.hex ?? fallback;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** A tasteful generated mark: brand initial(s) in the display font on a primary-colour tile. */
export function placeholderMarkSvg(genome: Genome, opts: { mono?: "dark" | "light"; shape?: "tile" | "circle" | "none" } = {}): string {
  const primary = paletteColor(genome, "primary", "#1f1f1f");
  const bg = opts.mono === "dark" ? "#111111" : opts.mono === "light" ? "#ffffff" : primary;
  const fg = opts.mono ? (opts.mono === "dark" ? "#ffffff" : "#111111") : bestTextOn(primary);
  const words = (genome.visual.logo.wordmarkText || genome.name || "Brand").trim().split(/\s+/);
  const initials = escapeXml(words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""));
  const font = genome.visual.typography.display.family;
  const shape = opts.shape ?? "tile";
  const bgEl = shape === "circle" ? `<circle cx="128" cy="128" r="128" fill="${bg}"/>` : shape === "tile" ? `<rect width="256" height="256" rx="56" fill="${bg}"/>` : "";
  const textFill = shape === "none" ? primary : fg;
  const size = initials.length > 1 ? 118 : 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${bgEl}<text x="128" y="${initials.length > 1 ? 172 : 182}" text-anchor="middle" font-family="${escapeXml(font)}, serif" font-size="${size}" font-weight="600" fill="${textFill}" letter-spacing="-4">${initials}</text></svg>`;
}

export function placeholderWordmarkSvg(genome: Genome, color?: string): string {
  const text = escapeXml(genome.visual.logo.wordmarkText || genome.name || "Brand");
  const fill = color ?? paletteColor(genome, "primary", "#1f1f1f");
  const font = genome.visual.typography.display.family;
  const w = Math.max(200, text.length * 58);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 120" width="${w}" height="120"><text x="0" y="88" font-family="${escapeXml(font)}, serif" font-size="96" font-weight="600" fill="${fill}" letter-spacing="-2">${text}</text></svg>`;
}

/** All logo artworks present in the project keyed by variant, plus mark/wordmark. */
export function getLogoVariants(genome: Genome, assets: Asset[]): Partial<Record<LogoVariantKey | "mark" | "wordmark", LogoArtwork>> {
  const out: Partial<Record<LogoVariantKey | "mark" | "wordmark", LogoArtwork>> = {};
  const byId = new Map(assets.map((a) => [a.id, a]));
  const svgOf = (id?: string) => {
    const a = id ? byId.get(id) : undefined;
    return a?.svg ?? undefined;
  };
  const mark = svgOf(genome.visual.logo.markAssetId);
  if (mark) out.mark = { svg: mark, source: "mark", assetId: genome.visual.logo.markAssetId, label: "Mark" };
  const wm = svgOf(genome.visual.logo.wordmarkAssetId);
  if (wm) out.wordmark = { svg: wm, source: "wordmark", assetId: genome.visual.logo.wordmarkAssetId, label: "Wordmark" };
  for (const [key, id] of Object.entries(genome.visual.logo.variants)) {
    const svg = svgOf(id);
    if (svg) out[key as LogoVariantKey] = { svg, source: "variant", assetId: id, label: key };
  }
  return out;
}

/** Best available primary logo: variant → mark → wordmark → any SVG asset tagged logo → placeholder. */
export function primaryLogo(genome: Genome, assets: Asset[], prefer: (LogoVariantKey | "mark" | "wordmark")[] = ["primary", "horizontal", "mark", "stacked", "wordmark"]): LogoArtwork {
  const variants = getLogoVariants(genome, assets);
  for (const k of prefer) if (variants[k]) return variants[k]!;
  const any = assets.find((a) => a.kind === "svg" && a.stage === "logo" && a.svg);
  if (any?.svg) return { svg: any.svg, source: "asset", assetId: any.id, label: any.name };
  return { svg: placeholderMarkSvg(genome), source: "placeholder", label: "Placeholder mark" };
}

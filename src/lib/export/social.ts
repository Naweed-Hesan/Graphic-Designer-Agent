"use client";
/**
 * Social kit renderer: profile avatars and platform cover images drawn on
 * canvas with the brand fonts and the project's logo artwork (or the generated
 * placeholder, drawn natively so the display font is used).
 */
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { getLogoVariants, primaryLogo, paletteColor, type LogoArtwork } from "@/lib/logo/assets";
import { bestTextOn, wcagRatio } from "@/lib/color/contrast";
import { svgSize, svgToImage } from "@/lib/raster";

export interface SocialSpec {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  kind: "avatar" | "cover";
  /** Avatar surface */
  surface?: "primary" | "background";
  /** Central safe area for platforms that crop (YouTube) */
  safe?: { width: number; height: number };
  file: string;
}

export const SOCIAL_SPECS: SocialSpec[] = [
  { id: "avatar-400-primary", label: "Avatar · on primary", platform: "Profile 400²", width: 400, height: 400, kind: "avatar", surface: "primary", file: "avatar-400-primary.png" },
  { id: "avatar-400-background", label: "Avatar · on background", platform: "Profile 400²", width: 400, height: 400, kind: "avatar", surface: "background", file: "avatar-400-background.png" },
  { id: "avatar-800-primary", label: "Avatar · on primary", platform: "Profile 800²", width: 800, height: 800, kind: "avatar", surface: "primary", file: "avatar-800-primary.png" },
  { id: "avatar-800-background", label: "Avatar · on background", platform: "Profile 800²", width: 800, height: 800, kind: "avatar", surface: "background", file: "avatar-800-background.png" },
  { id: "cover-linkedin", label: "LinkedIn cover", platform: "1584 × 396", width: 1584, height: 396, kind: "cover", file: "cover-linkedin-1584x396.png" },
  { id: "cover-x", label: "X header", platform: "1500 × 500", width: 1500, height: 500, kind: "cover", file: "cover-x-1500x500.png" },
  { id: "cover-youtube", label: "YouTube banner", platform: "2560 × 1440 · safe 1546 × 423", width: 2560, height: 1440, kind: "cover", safe: { width: 1546, height: 423 }, file: "cover-youtube-2560x1440.png" },
  { id: "cover-facebook", label: "Facebook cover", platform: "820 × 312", width: 820, height: 312, kind: "cover", file: "cover-facebook-820x312.png" },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function initialsOf(genome: Genome): string {
  const words = (genome.visual.logo.wordmarkText || genome.name || "Brand").trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function wordmarkText(genome: Genome): string {
  const raw = genome.visual.logo.wordmarkText || genome.name || "Brand";
  const c = genome.visual.logo.wordmarkCase;
  return c === "uppercase" ? raw.toUpperCase() : c === "lowercase" ? raw.toLowerCase() : raw;
}

function fontFor(genome: Genome, role: "display" | "body" | "mono", weight: number, px: number): string {
  const f = genome.visual.typography[role];
  const w = f.weights.includes(weight) ? weight : (f.weights.slice().sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight))[0] ?? weight);
  return `${w} ${px}px "${f.family}", ${f.fallback || "sans-serif"}`;
}

/** Ask the browser for the brand fonts before drawing; never blocks for long. */
export async function loadBrandFonts(genome: Genome): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const loads = [document.fonts.load(fontFor(genome, "display", 600, 48)), document.fonts.load(fontFor(genome, "display", 400, 48)), document.fonts.load(fontFor(genome, "body", 400, 24))];
  try {
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fall back to the stack */
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Placeholder mark: rounded tile with the initials in the display face. `tile` null = no tile, initials only. */
function drawPlaceholderMark(ctx: CanvasRenderingContext2D, genome: Genome, box: Box, tile: string | null, fg: string) {
  const size = Math.min(box.w, box.h);
  const x = box.x + (box.w - size) / 2;
  const y = box.y + (box.h - size) / 2;
  if (tile) {
    ctx.fillStyle = tile;
    roundRect(ctx, x, y, size, size, size * 0.22);
    ctx.fill();
  }
  const text = initialsOf(genome);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = fontFor(genome, "display", 600, Math.round(size * (text.length > 1 ? 0.46 : 0.58)));
  ctx.fillText(text, x + size / 2, y + size * 0.54);
}

function drawPlaceholderWordmark(ctx: CanvasRenderingContext2D, genome: Genome, x: number, cy: number, height: number, fill: string): number {
  const text = wordmarkText(genome);
  const weight = genome.visual.logo.wordmarkWeight || 600;
  const role = genome.visual.logo.wordmarkFont;
  ctx.font = fontFor(genome, role, weight, Math.round(height));
  ctx.fillStyle = fill;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = `${genome.visual.logo.wordmarkTracking || 0}em`;
  ctx.fillText(text, x, cy + height * 0.04);
  const w = ctx.measureText(text).width;
  ctx.letterSpacing = "0px";
  return w;
}

async function drawSvgContain(ctx: CanvasRenderingContext2D, svg: string, box: Box) {
  const size = svgSize(svg);
  const scale = Math.min(box.w / size.width, box.h / size.height);
  const dw = size.width * scale;
  const dh = size.height * scale;
  const img = await svgToImage(svg, Math.ceil(dw), Math.ceil(dh));
  ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
}

/** Draw a horizontal lockup (mark + wordmark) into `box`, left-aligned, vertically centred. Returns the used width. */
async function drawLockup(ctx: CanvasRenderingContext2D, genome: Genome, art: LogoArtwork, box: Box, color: { tile: string | null; fg: string; onTile: string }): Promise<number> {
  if (art.source !== "placeholder") {
    const size = svgSize(art.svg);
    const scale = Math.min(box.w / size.width, box.h / size.height);
    const dw = size.width * scale;
    const dh = size.height * scale;
    const img = await svgToImage(art.svg, Math.ceil(dw), Math.ceil(dh));
    ctx.drawImage(img, box.x, box.y + (box.h - dh) / 2, dw, dh);
    return dw;
  }
  const markSize = box.h;
  drawPlaceholderMark(ctx, genome, { x: box.x, y: box.y, w: markSize, h: markSize }, color.tile, color.tile ? color.onTile : color.fg);
  const gap = markSize * 0.2;
  const w = drawPlaceholderWordmark(ctx, genome, box.x + markSize + gap, box.y + box.h / 2, markSize * 0.66, color.fg);
  return markSize + gap + w;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[,;:]?\s*\S*$/, "…");
    return kept;
  }
  return lines;
}

export interface SocialColors {
  primary: string;
  onPrimary: string;
  background: string;
  text: string;
  accent: string;
}

export function socialColors(genome: Genome): SocialColors {
  const primary = paletteColor(genome, "primary", "#1f1f1f");
  const background = paletteColor(genome, "background", "#ffffff");
  const textRaw = paletteColor(genome, "text", bestTextOn(background));
  const text = wcagRatio(textRaw, background) >= 3 ? textRaw : bestTextOn(background);
  return { primary, onPrimary: bestTextOn(primary), background, text, accent: paletteColor(genome, "accent", primary) };
}

/** Render one social asset to a canvas at its native size. */
export async function renderSocialAsset(genome: Genome, assets: Asset[], spec: SocialSpec): Promise<HTMLCanvasElement> {
  await loadBrandFonts(genome);
  const c = socialColors(genome);
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d")!;
  const variants = getLogoVariants(genome, assets);

  if (spec.kind === "avatar") {
    const onPrimary = spec.surface === "primary";
    const bg = onPrimary ? c.primary : c.background;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, spec.width, spec.height);
    const inset = spec.width * 0.22;
    const box: Box = { x: inset, y: inset, w: spec.width - inset * 2, h: spec.height - inset * 2 };
    const monoKey = bestTextOn(bg) === "#ffffff" ? "mono-light" : "mono-dark";
    const art: LogoArtwork | undefined = onPrimary ? (variants[monoKey] ?? variants.mark ?? variants.favicon) : (variants.mark ?? variants.favicon ?? variants[monoKey]);
    if (art) await drawSvgContain(ctx, art.svg, box);
    else if (onPrimary) drawPlaceholderMark(ctx, genome, { x: 0, y: 0, w: spec.width, h: spec.height }, null, c.onPrimary);
    else drawPlaceholderMark(ctx, genome, box, c.primary, c.onPrimary);
    return canvas;
  }

  // Covers
  const primaryIsBg = c.background.toLowerCase() === c.primary.toLowerCase();
  const bg = c.background;
  const fg = primaryIsBg ? c.onPrimary : c.text;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, spec.width, spec.height);
  const safeW = spec.safe?.width ?? spec.width;
  const safeH = spec.safe?.height ?? spec.height;
  const sx = (spec.width - safeW) / 2;
  const sy = (spec.height - safeH) / 2;
  if (spec.safe) {
    // Soft field behind the safe area so the crop reads on the full-size banner.
    ctx.fillStyle = c.primary;
    ctx.globalAlpha = 0.06;
    ctx.fillRect(0, sy - safeH * 0.35, spec.width, safeH * 1.7);
    ctx.globalAlpha = 1;
  }
  const pad = safeH * 0.2;
  const logoH = safeH * 0.4;
  const art = primaryLogo(genome, assets, ["horizontal", "primary", "wordmark", "stacked", "mark"]);
  const logoBox: Box = { x: sx + pad, y: sy + (safeH - logoH) / 2, w: safeW * 0.5, h: logoH };
  const used = await drawLockup(ctx, genome, art, logoBox, { tile: primaryIsBg ? null : c.primary, fg: primaryIsBg ? c.onPrimary : c.primary, onTile: c.onPrimary });

  const tagline = genome.strategy.tagline || genome.strategy.positioning.split(/[.!?]/)[0] || "";
  if (tagline) {
    const maxW = safeW - pad * 2 - used - pad;
    let px = Math.round(safeH * 0.12);
    ctx.font = fontFor(genome, "display", 400, px);
    let lines = wrapLines(ctx, tagline, maxW, 2);
    while (px > 10 && lines.some((l) => ctx.measureText(l).width > maxW)) {
      px -= 2;
      ctx.font = fontFor(genome, "display", 400, px);
      lines = wrapLines(ctx, tagline, maxW, 2);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const lh = px * 1.2;
    const startY = sy + safeH / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, sx + safeW - pad, startY + i * lh));
  }
  // Accent rule along the bottom of the safe area.
  ctx.fillStyle = c.accent;
  ctx.fillRect(sx + pad, sy + safeH - Math.max(3, safeH * 0.02) - safeH * 0.08, safeW - pad * 2, Math.max(3, safeH * 0.012));
  return canvas;
}

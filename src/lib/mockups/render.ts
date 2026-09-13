"use client";
/** Scene preparation (logos rasterised once, fonts loaded) and template rendering. */
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { getLogoVariants, paletteColor, placeholderMarkSvg, placeholderWordmarkSvg, primaryLogo } from "@/lib/logo/assets";
import { canvasToBlob, svgSize, svgToImage } from "@/lib/raster";
import { ensureFont, fontStack } from "@/lib/type/fonts";
import { darken, safeHex } from "./color";
import { drawText, font as fontStr } from "./draw";
import { DEFAULT_OPTIONS, type Drawable, type LogoKind, type MockupScene, type MockupTemplate, type SceneColors, type SceneLogos, type SceneOptions } from "./types";

const RASTER_MAX = 1024;

async function raster(svg: string): Promise<HTMLImageElement> {
  const { width, height } = svgSize(svg);
  const s = RASTER_MAX / Math.max(width, height);
  return svgToImage(svg, Math.max(1, Math.round(width * s)), Math.max(1, Math.round(height * s)));
}

/** One-colour silhouette of any artwork (alpha preserved, colour replaced). */
export function silhouette(img: Drawable, color: string): HTMLCanvasElement {
  const w = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth || img.width;
  const h = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight || img.height;
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Initials only (no tile) so placeholder marks reproduce in one colour. */
function placeholderInitialsSvg(genome: Genome, color: string): string {
  const words = (genome.visual.logo.wordmarkText || genome.name || "Brand").trim().split(/\s+/);
  const initials = escapeXml(words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""));
  const font = escapeXml(genome.visual.typography.display.family);
  const size = initials.length > 1 ? 130 : 170;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><text x="128" y="${initials.length > 1 ? 176 : 190}" text-anchor="middle" font-family="${font}, serif" font-size="${size}" font-weight="600" fill="${color}" letter-spacing="-4">${initials}</text></svg>`;
}

export function sceneColors(genome: Genome): SceneColors {
  const primary = safeHex(paletteColor(genome, "primary", ""), "#1f1f1f");
  return {
    primary,
    secondary: safeHex(paletteColor(genome, "secondary", ""), darken(primary, 0.55)),
    accent: safeHex(paletteColor(genome, "accent", ""), primary),
    background: safeHex(paletteColor(genome, "background", ""), "#f4f1ea"),
    text: safeHex(paletteColor(genome, "text", ""), "#151515"),
    neutral: safeHex(paletteColor(genome, "neutral", ""), "#b9b4aa"),
  };
}

export function sceneText(genome: Genome): MockupScene["text"] {
  return {
    name: genome.name || genome.brief.clientName || "Brand",
    tagline: genome.strategy.tagline || genome.strategy.taglineOptions[0] || "",
    positioning: genome.strategy.positioning || genome.strategy.mission || genome.brief.description || "",
  };
}

/** Rasterises every logo the templates need. Expensive; call once per Genome revision. */
export async function prepareLogos(genome: Genome, assets: Asset[]): Promise<SceneLogos> {
  const variants = getLogoVariants(genome, assets);
  const primaryArt = primaryLogo(genome, assets);
  const placeholder = primaryArt.source === "placeholder";
  const colors = sceneColors(genome);

  const primarySvg = primaryArt.svg;
  const markSvg = variants.mark?.svg ?? variants.favicon?.svg ?? (placeholder ? placeholderMarkSvg(genome) : primaryArt.source === "wordmark" ? placeholderMarkSvg(genome) : primarySvg);
  const wordmarkSvg = variants.wordmark?.svg ?? (primaryArt.source === "wordmark" ? primarySvg : placeholderWordmarkSvg(genome, colors.primary));

  const [primary, mark, wordmark] = await Promise.all([raster(primarySvg), raster(markSvg), raster(wordmarkSvg)]);

  const mono = async (kind: LogoKind, base: Drawable, svgOfBase: string, color: string, projectSvg?: string): Promise<Drawable> => {
    if (projectSvg) return raster(projectSvg);
    // Placeholders carry a filled tile; use initials only so they reproduce in one colour.
    if (placeholder || svgOfBase === placeholderMarkSvg(genome)) {
      if (kind === "wordmark") return raster(placeholderWordmarkSvg(genome, color));
      return raster(placeholderInitialsSvg(genome, color));
    }
    return silhouette(base, color);
  };
  const white = "#ffffff";
  const black = "#111111";
  const monoLight = await mono("primary", primary, primarySvg, white, variants["mono-light"]?.svg);
  const monoDark = await mono("primary", primary, primarySvg, black, variants["mono-dark"]?.svg);
  const markIsPlaceholder = markSvg === placeholderMarkSvg(genome);
  const wmIsPlaceholder = !variants.wordmark && primaryArt.source !== "wordmark";
  const monoMark = {
    light: markIsPlaceholder ? await raster(placeholderInitialsSvg(genome, white)) : silhouette(mark, white),
    dark: markIsPlaceholder ? await raster(placeholderInitialsSvg(genome, black)) : silhouette(mark, black),
  };
  const monoWordmark = {
    light: wmIsPlaceholder ? await raster(placeholderWordmarkSvg(genome, white)) : silhouette(wordmark, white),
    dark: wmIsPlaceholder ? await raster(placeholderWordmarkSvg(genome, black)) : silhouette(wordmark, black),
  };
  return {
    primary,
    mark,
    wordmark,
    monoDark,
    monoLight,
    mono: { primary: { light: monoLight, dark: monoDark }, mark: monoMark, wordmark: monoWordmark },
    placeholder,
  };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Loads the brand fonts and waits (bounded) for them so canvas text uses the right faces. */
export async function prepareFonts(genome: Genome, timeoutMs = 2500): Promise<MockupScene["fonts"]> {
  const d = genome.visual.typography.display;
  const b = genome.visual.typography.body;
  ensureFont(d.family, [...new Set([...d.weights, 400, 600])]);
  ensureFont(b.family, [...new Set([...b.weights, 400, 500, 600, 700])]);
  const fonts = { display: fontStack(d.family, d.fallback || "serif"), body: fontStack(b.family, b.fallback || "sans-serif") };
  if (typeof document !== "undefined" && document.fonts) {
    const loads = [
      document.fonts.load(`600 40px ${fonts.display}`),
      document.fonts.load(`400 40px ${fonts.display}`),
      document.fonts.load(`400 16px ${fonts.body}`),
      document.fonts.load(`600 16px ${fonts.body}`),
      document.fonts.ready,
    ].map((p) => Promise.resolve(p).catch(() => undefined));
    await Promise.race([Promise.all(loads), sleep(timeoutMs)]);
  }
  return fonts;
}

export interface PreparedScene {
  logos: SceneLogos;
  fonts: MockupScene["fonts"];
}

/** Prepares the heavy, cacheable part of a scene (logos + fonts). */
export async function prepareSceneAssets(genome: Genome, assets: Asset[]): Promise<PreparedScene> {
  const [logos, fonts] = await Promise.all([prepareLogos(genome, assets), prepareFonts(genome)]);
  return { logos, fonts };
}

/** Builds a full scene from prepared assets and the current options. Cheap; call per render. */
export function buildScene(genome: Genome, prepared: PreparedScene, options: Partial<SceneOptions> = {}, pixelRatio = 1): MockupScene {
  return {
    genome,
    logos: prepared.logos,
    fonts: prepared.fonts,
    colors: sceneColors(genome),
    text: sceneText(genome),
    options: { ...DEFAULT_OPTIONS, ...options },
    pixelRatio,
  };
}

/** Convenience: prepare + build in one call. */
export async function prepareScene(genome: Genome, assets: Asset[], options: Partial<SceneOptions> = {}): Promise<MockupScene> {
  const prepared = await prepareSceneAssets(genome, assets);
  return buildScene(genome, prepared, options, 1);
}

/** Renders a template into a fresh canvas at `scale` × its native size. */
export function renderTemplate(template: MockupTemplate, scene: MockupScene, scale = 2, target?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = target ?? document.createElement("canvas");
  const w = Math.max(1, Math.round(template.size.width * scale));
  const h = Math.max(1, Math.round(template.size.height * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  try {
    template.render(ctx, { ...scene, pixelRatio: scale });
  } finally {
    ctx.restore();
  }
  return canvas;
}

export interface RenderedMockup {
  template: MockupTemplate;
  blob: Blob;
  width: number;
  height: number;
}

/** Renders many templates to PNG blobs, yielding to the event loop between them. */
export async function renderAll(templates: MockupTemplate[], scene: MockupScene, scale = 2, onProgress?: (done: number, total: number, template: MockupTemplate) => void): Promise<RenderedMockup[]> {
  const out: RenderedMockup[] = [];
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const canvas = renderTemplate(t, scene, scale);
    const blob = await canvasToBlob(canvas, "image/png");
    out.push({ template: t, blob, width: canvas.width, height: canvas.height });
    onProgress?.(i + 1, templates.length, t);
    await sleep(0);
  }
  return out;
}

/** Client-presentation board: brand header plus a grid of the featured mockups. */
export function renderBoard(templates: MockupTemplate[], scene: MockupScene, opts: { columns?: number; cell?: { w: number; h: number }; scale?: number } = {}): HTMLCanvasElement {
  const columns = opts.columns ?? 3;
  const cell = opts.cell ?? { w: 620, h: 465 };
  const scale = opts.scale ?? 1;
  const gap = 36, margin = 60, header = 150, caption = 34;
  const rows = Math.ceil(templates.length / columns);
  const W = margin * 2 + columns * cell.w + (columns - 1) * gap;
  const H = margin + header + rows * (cell.h + caption) + (rows - 1) * gap + margin;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  const dark = scene.options.theme === "dark";
  const bg = dark ? "#141518" : "#f4f2ee";
  const ink = dark ? "#f4f4f4" : "#15161a";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Header.
  drawText(ctx, "BRAND APPLICATIONS", margin, margin + 22, { font: fontStr(600, 13, scene.fonts.body), color: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)", letterSpacing: 3 });
  drawText(ctx, scene.text.name, margin, margin + 84, { font: fontStr(600, 56, scene.fonts.display), color: ink, letterSpacing: -1 });
  if (scene.text.tagline) drawText(ctx, scene.text.tagline, W - margin, margin + 84, { font: fontStr(400, 26, scene.fonts.display, true), color: dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)", align: "right" });
  ctx.fillStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  ctx.fillRect(margin, margin + 112, W - margin * 2, 1);
  // Cells.
  templates.forEach((t, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    const x = margin + col * (cell.w + gap);
    const y = margin + header + row * (cell.h + caption + gap);
    const s = Math.min(cell.w / t.size.width, cell.h / t.size.height);
    const w = t.size.width * s, h = t.size.height * s;
    const ox = x + (cell.w - w) / 2, oy = y + (cell.h - h) / 2;
    const img = renderTemplate(t, scene, Math.min(2, s * scale * 1.5));
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, h, 14);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, h, 14);
    ctx.clip();
    ctx.drawImage(img, ox, oy, w, h);
    ctx.restore();
    drawText(ctx, t.name, x + 4, y + cell.h + 24, { font: fontStr(500, 14, scene.fonts.body), color: dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" });
  });
  return canvas;
}

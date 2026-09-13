/** Shared drawing vocabulary for mockup templates: surfaces, shadows, text, logo placement. */
import { hexToRgb } from "@/lib/color/contrast";
import { alpha, darken, isDark, lighten, luminance, mix } from "./color";
import { applyGrain, applyPaper, mulberry32 } from "./noise";
import { containRect, drawImageContainOnSurface, drawImageToQuad, quadPath, type Align, type Point, type Quad, type Rect, type SurfaceMap } from "./perspective";
import type { Drawable, LogoKind, MockupScene } from "./types";

export type Ctx = CanvasRenderingContext2D;

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export const inset = (r: Rect, d: number, dy = d): Rect => ({ x: r.x + d, y: r.y + dy, w: r.w - d * 2, h: r.h - dy * 2 });

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function fillRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient | CanvasPattern): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function radial(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export interface Shadow {
  blur: number;
  x?: number;
  y?: number;
  color: string;
}

/** Fills the current path with layered soft shadows (ambient + contact). */
export function shadowedFill(ctx: Ctx, path: () => void, fill: string | CanvasGradient | CanvasPattern, shadows: Shadow[]): void {
  for (const s of shadows) {
    ctx.save();
    ctx.shadowBlur = s.blur;
    ctx.shadowOffsetX = s.x ?? 0;
    ctx.shadowOffsetY = s.y ?? 0;
    ctx.shadowColor = s.color;
    path();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** Standard two-layer object shadow relative to an object of size `h`. */
export function objectShadows(h: number, strength = 1, dir: Point = { x: 0.15, y: 1 }): Shadow[] {
  return [
    { blur: h * 0.5, x: dir.x * h * 0.08, y: dir.y * h * 0.14, color: `rgba(20, 16, 12, ${0.22 * strength})` },
    { blur: h * 0.06, x: dir.x * h * 0.02, y: dir.y * h * 0.03, color: `rgba(20, 16, 12, ${0.18 * strength})` },
  ];
}

/** Soft elliptical contact shadow on the ground under an object. */
export function groundShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, strength = 0.35): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, 0, rx, [
    [0, `rgba(15, 12, 10, ${strength})`],
    [0.55, `rgba(15, 12, 10, ${strength * 0.45})`],
    [1, "rgba(15, 12, 10, 0)"],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ────────────────────────── scene colours ────────────────────────── */

/** Backdrop colour for the environment (table, wall, studio sweep). */
export function backdropColor(scene: MockupScene): string {
  const o = scene.options;
  if (o.background) return o.background;
  const c = scene.colors;
  if (o.theme === "dark") {
    const base = isDark(c.secondary) ? c.secondary : darken(c.primary, 0.6);
    return mix(base, "#15151a", 0.55);
  }
  return mix(isDark(c.background) ? "#f2efe9" : c.background, "#e6e2da", 0.45);
}

/** Paints a studio backdrop: base colour, soft top-light, vignette and grain. */
export function backdrop(ctx: Ctx, scene: MockupScene, w: number, h: number, opts: { color?: string; light?: number; vignette?: number } = {}): string {
  const base = opts.color ?? backdropColor(scene);
  const dark = isDark(base);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const light = opts.light ?? 1;
  // Top-left key light.
  ctx.fillStyle = radial(ctx, w * 0.3, h * 0.1, 0, Math.max(w, h) * 0.9, [
    [0, dark ? `rgba(255,255,255,${0.09 * light})` : `rgba(255,255,255,${0.42 * light})`],
    [1, "rgba(255,255,255,0)"],
  ]);
  ctx.fillRect(0, 0, w, h);
  // Vignette.
  const v = opts.vignette ?? 1;
  ctx.fillStyle = radial(ctx, w * 0.5, h * 0.55, Math.min(w, h) * 0.35, Math.max(w, h) * 0.85, [
    [0, "rgba(0,0,0,0)"],
    [1, `rgba(0,0,0,${(dark ? 0.35 : 0.14) * v})`],
  ]);
  ctx.fillRect(0, 0, w, h);
  grainRect(ctx, scene, 0, 0, w, h, 0.6);
  return base;
}

export function grainRect(ctx: Ctx, scene: MockupScene, x: number, y: number, w: number, h: number, mult = 1): void {
  applyGrain(ctx, x, y, w, h, scene.options.grain * mult);
}

export function paperRect(ctx: Ctx, scene: MockupScene, x: number, y: number, w: number, h: number, mult = 1): void {
  applyPaper(ctx, x, y, w, h, 0.18 + scene.options.grain * 0.35 * mult);
}

/** True when a surface colour is a "brand colour" (saturated or dark) rather than light neutral paper. */
export function isColouredSurface(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return luminance(hex) < 0.5 || chroma > 60;
}

/** Ink colour (dark/light) for text on a surface. */
export function inkOn(scene: MockupScene, surface: string): string {
  return isDark(surface) ? mix("#ffffff", surface, 0.06) : mix(scene.colors.text, surface, 0.04);
}

export function mutedInkOn(scene: MockupScene, surface: string): string {
  return isDark(surface) ? alpha("#ffffff", 0.62) : alpha(scene.colors.text, 0.6);
}

/* ────────────────────────── logos ────────────────────────── */

export interface LogoPick {
  /** Which artwork a template would like when the user leaves the variant on Auto. */
  prefer?: LogoKind;
  /** Force one-colour reproduction (embroidery, engraving, signage). */
  mono?: boolean;
  /** Force this kind regardless of the user choice (app icons need a mark). */
  force?: LogoKind;
}

/** Chooses the artwork for a surface colour, honouring the user's variant/invert choices. */
export function pickLogo(scene: MockupScene, surface: string, pick: LogoPick = {}): Drawable {
  const { variant, invert } = scene.options;
  const L = scene.logos;
  const kind: LogoKind = pick.force ?? (variant === "auto" || variant === "mono" ? (pick.prefer ?? "primary") : variant);
  const wantMono = pick.mono || variant === "mono" || isColouredSurface(surface);
  if (!wantMono) return L[kind];
  const light = isDark(surface) !== invert;
  return L.mono[kind][light ? "light" : "dark"];
}

/** Applies the user's scale/offset controls to a logo area. */
function withUser(scene: MockupScene, opts: { scale?: number; offset?: Point } = {}) {
  const o = scene.options;
  return {
    scale: (opts.scale ?? 1) * o.logoScale,
    offset: { x: (opts.offset?.x ?? 0) + o.logoOffset.x, y: (opts.offset?.y ?? 0) + o.logoOffset.y },
  };
}

/** Draws a logo fitted into a flat rect. Returns the drawn rect. */
export function drawLogo(ctx: Ctx, scene: MockupScene, img: Drawable, area: Rect, opts: { scale?: number; offset?: Point; alignX?: Align; alignY?: Align; alpha?: number } = {}): Rect {
  const iw = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth || img.width;
  const ih = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight || img.height;
  if (!iw || !ih) return area;
  const u = withUser(scene, opts);
  const r = containRect(iw, ih, area, { scale: u.scale, offset: u.offset, alignX: opts.alignX, alignY: opts.alignY });
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  ctx.restore();
  return r;
}

/** Draws a logo into a rect of a surface (unit coords) and warps it through the surface map. */
export function drawLogoOnSurface(ctx: Ctx, scene: MockupScene, img: Drawable, map: SurfaceMap, surfaceAspect: number, area: Rect, opts: { scale?: number; offset?: Point; alignX?: Align; alignY?: Align; alpha?: number; cols?: number; rows?: number } = {}): void {
  const u = withUser(scene, opts);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  drawImageContainOnSurface(ctx, img, map, surfaceAspect, area, { scale: u.scale, offset: u.offset, alignX: opts.alignX, alignY: opts.alignY, mesh: opts.cols ? { cols: opts.cols, rows: opts.rows ?? opts.cols } : undefined });
  ctx.restore();
}

/* ────────────────────────── faces (render flat, then warp) ────────────────────────── */

/**
 * Renders a flat face at a resolution matched to its on-screen size, then warps it into `quad`.
 * `draw` receives a context whose coordinate space is `w × h` (the face's own units).
 */
export function drawFace(ctx: Ctx, scene: MockupScene, w: number, h: number, quad: Quad, draw: (fctx: Ctx, w: number, h: number) => void, opts: { oversample?: number } = {}): void {
  const bw = Math.max(...quad.map((p) => p.x)) - Math.min(...quad.map((p) => p.x));
  const bh = Math.max(...quad.map((p) => p.y)) - Math.min(...quad.map((p) => p.y));
  const os = opts.oversample ?? 1.4;
  const px = Math.max(bw, bh) * scene.pixelRatio * os;
  const s = Math.max(0.05, Math.min(4, px / Math.max(w, h)));
  const face = document.createElement("canvas");
  face.width = Math.max(2, Math.round(w * s));
  face.height = Math.max(2, Math.round(h * s));
  const fctx = face.getContext("2d")!;
  fctx.scale(face.width / w, face.height / h);
  draw(fctx, w, h);
  drawImageToQuad(ctx, face, quad, { expand: 0.7 });
}

/** Overlays a gradient/colour inside a quad (for lighting on warped faces). */
export function shadeQuad(ctx: Ctx, quad: Quad, fill: string | CanvasGradient, composite: GlobalCompositeOperation = "source-over"): void {
  ctx.save();
  ctx.globalCompositeOperation = composite;
  quadPath(ctx, quad);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** Fills a quad with soft shadows underneath (call before drawing the face). */
export function quadShadow(ctx: Ctx, quad: Quad, shadows: Shadow[], color = "#000"): void {
  shadowedFill(ctx, () => quadPath(ctx, quad), color, shadows);
}

/* ────────────────────────── text ────────────────────────── */

export function font(weight: number | string, size: number, family: string, italic = false): string {
  return `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
}

export interface TextOpts {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  letterSpacing?: number;
  maxWidth?: number;
  transform?: "none" | "uppercase";
}

function setSpacing(ctx: Ctx, px: number | undefined): void {
  const c = ctx as Ctx & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${px ?? 0}px`;
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts): number {
  const t = o.transform === "uppercase" ? text.toUpperCase() : text;
  ctx.save();
  ctx.font = o.font;
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  setSpacing(ctx, o.letterSpacing);
  if (o.maxWidth) ctx.fillText(t, x, y, o.maxWidth);
  else ctx.fillText(t, x, y);
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
}

export function measure(ctx: Ctx, text: string, fontStr: string, letterSpacing = 0): number {
  ctx.save();
  ctx.font = fontStr;
  setSpacing(ctx, letterSpacing);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/** Largest font size ≤ `max` (≥ `min`) at which `text` fits `maxWidth`. */
export function fitFontSize(ctx: Ctx, text: string, family: string, weight: number | string, maxWidth: number, max: number, min = 8, tracking = 0): number {
  let size = max;
  while (size > min) {
    const w = measure(ctx, text, font(weight, size, family), tracking * size);
    if (w <= maxWidth) break;
    size = Math.max(min, Math.floor(size * Math.min(0.94, maxWidth / w)));
    if (size === min) break;
  }
  return size;
}

/** Greedy word wrap. */
export function wrapText(ctx: Ctx, text: string, fontStr: string, maxWidth: number, maxLines = 6): string[] {
  ctx.save();
  ctx.font = fontStr;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s?\S*$/, "…");
  ctx.restore();
  return lines;
}

/** Draws wrapped text; returns the y after the last line. */
export function drawParagraph(ctx: Ctx, text: string, x: number, y: number, o: TextOpts & { maxWidth: number; lineHeight: number; maxLines?: number }): number {
  const lines = wrapText(ctx, o.transform === "uppercase" ? text.toUpperCase() : text, o.font, o.maxWidth, o.maxLines ?? 6);
  let yy = y;
  for (const line of lines) {
    drawText(ctx, line, x, yy, { ...o, transform: "none", maxWidth: undefined });
    yy += o.lineHeight;
  }
  return yy;
}

/** "Greeked" body copy: rounded bars of varying length standing in for text. */
export function greekLines(ctx: Ctx, x: number, y: number, w: number, count: number, o: { lineHeight: number; thickness?: number; color: string; seed?: number; paragraphEvery?: number }): number {
  const rnd = mulberry32(o.seed ?? 3);
  const th = o.thickness ?? o.lineHeight * 0.34;
  let yy = y;
  for (let i = 0; i < count; i++) {
    const last = (i + 1) % (o.paragraphEvery ?? 5) === 0;
    const len = last ? w * (0.35 + rnd() * 0.3) : w * (0.86 + rnd() * 0.14);
    fillRoundRect(ctx, x, yy, len, th, th / 2, o.color);
    yy += o.lineHeight + (last ? o.lineHeight * 0.6 : 0);
  }
  return yy;
}

/* ────────────────────────── small furniture ────────────────────────── */

/** A tiny "icon" placeholder: a circle or rounded square with a lighter glyph. */
export function glyphTile(ctx: Ctx, x: number, y: number, s: number, bg: string, fg: string, shape: "circle" | "square" | "lines" = "square"): void {
  fillRoundRect(ctx, x, y, s, s, s * 0.22, bg);
  ctx.fillStyle = fg;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "lines") {
    for (let i = 0; i < 3; i++) fillRoundRect(ctx, x + s * 0.28, y + s * 0.32 + i * s * 0.16, s * (0.44 - i * 0.1), s * 0.07, s * 0.035, fg);
  } else {
    fillRoundRect(ctx, x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4, s * 0.08, fg);
  }
}

export function lightSurface(scene: MockupScene, base?: string): string {
  const b = base ?? scene.colors.background;
  return isDark(b) ? "#f6f4ef" : lighten(b, 0.35);
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/* ────────────────────────── scene furniture ────────────────────────── */

import { projectQuad, type Camera, type Vec3 } from "./perspective";
import { slugify } from "@/lib/utils";

/**
 * Projects a rectangle lying on a table (x right, y away from the viewer, z up) to a screen quad.
 * Use a camera with a negative `rotX` so the far edge recedes.
 */
export function tableQuad(cam: Camera, cx: number, cy: number, w: number, h: number, angle = 0, z = 0): Quad {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const corner = (lx: number, ly: number): Vec3 => ({ x: cx + lx * c - ly * s, y: cy + lx * s + ly * c, z });
  return projectQuad([corner(-w / 2, h / 2), corner(w / 2, h / 2), corner(w / 2, -h / 2), corner(-w / 2, -h / 2)], cam);
}

/** Backdrop split into a wall and a table plane at `horizon` (0–1 of height). */
export function backdropWithTable(ctx: Ctx, scene: MockupScene, w: number, h: number, horizon = 0.62): { wall: string; table: string } {
  const wall = backdrop(ctx, scene, w, h, { vignette: 0.6 });
  const dark = isDark(wall);
  const table = dark ? darken(wall, 0.25) : darken(wall, 0.08);
  const y = h * horizon;
  ctx.fillStyle = linear(ctx, 0, y, 0, h, [
    [0, dark ? lighten(table, 0.04) : lighten(table, 0.08)],
    [1, table],
  ]);
  ctx.fillRect(0, y, w, h - y);
  // Soft horizon line (wall meets table).
  ctx.fillStyle = linear(ctx, 0, y - 40, 0, y + 6, [
    [0, "rgba(0,0,0,0)"],
    [1, dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)"],
  ]);
  ctx.fillRect(0, y - 40, w, 46);
  grainRect(ctx, scene, 0, y, w, h - y, 0.4);
  return { wall, table };
}

export function domainOf(scene: MockupScene): string {
  return `${slugify(scene.text.name) || "brand"}.com`;
}

export function handleOf(scene: MockupScene): string {
  return `@${(slugify(scene.text.name) || "brand").replace(/-/g, "")}`;
}

/** First sentence (or first ~n chars) of a longer piece of copy. */
export function excerpt(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const first = t.split(/(?<=[.!?])\s/)[0];
  const s = first.length > max ? `${t.slice(0, max).replace(/\s\S*$/, "")}…` : first;
  return s;
}

/** Surface colour a template should use for its main brand-coloured object. */
export function brandSurface(scene: MockupScene): string {
  const c = scene.colors;
  if (scene.options.theme === "dark") return isDark(c.secondary) ? c.secondary : darken(c.primary, 0.35);
  return c.primary;
}

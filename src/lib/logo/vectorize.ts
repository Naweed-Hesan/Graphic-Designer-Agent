"use client";
/**
 * Raster → SVG tracing for logo concepts (imagetracerjs behind a dynamic import),
 * plus optional ML background removal (@imgly/background-removal).
 */
import { blobToImage } from "@/lib/raster";
import { collectColors, fitViewBox, normalizeColor, setRootAttrs } from "./svg";

export type TracePreset = "default" | "posterized1" | "posterized2" | "posterized3" | "curvy" | "sharp" | "detailed" | "smoothed" | "grayscale" | "artistic2";

export const TRACE_PRESETS: { id: TracePreset; label: string; hint: string }[] = [
  { id: "default", label: "Balanced", hint: "General purpose; 16 colours" },
  { id: "posterized2", label: "Posterised", hint: "4 colours, blurred — flat logo marks" },
  { id: "posterized1", label: "Two-tone", hint: "2 colours, crisp silhouettes" },
  { id: "curvy", label: "Curvy", hint: "Smooth curves, no right-angle snapping" },
  { id: "sharp", label: "Sharp", hint: "Straight edges, precise corners" },
  { id: "detailed", label: "Detailed", hint: "Keeps small features; many paths" },
  { id: "smoothed", label: "Smoothed", hint: "Heavy blur before tracing" },
  { id: "grayscale", label: "Greyscale", hint: "7 grey levels" },
  { id: "artistic2", label: "Poster art", hint: "4 colours, no strokes" },
];

export interface VectorizeOptions {
  preset?: TracePreset;
  numberofcolors?: number;
  pathomit?: number;
  ltres?: number;
  qtres?: number;
  blurradius?: number;
  strokewidth?: number;
  roundcoords?: number;
  /** Longest edge the source is downscaled to before tracing (≤ 1024). */
  maxSize?: number;
  /** Drop near-white and fully transparent layers so the mark sits on a transparent background. */
  removeBackground?: boolean;
  /** Luma threshold (0–255) above which a layer counts as "white" background. */
  whiteThreshold?: number;
  /** Tighten the viewBox to the traced shapes. */
  fit?: boolean;
}

export interface VectorizeResult {
  svg: string;
  width: number;
  height: number;
  colors: string[];
  paths: number;
}

export const DEFAULT_VECTORIZE: Required<Pick<VectorizeOptions, "preset" | "numberofcolors" | "pathomit" | "ltres" | "qtres" | "blurradius">> = {
  preset: "posterized2",
  numberofcolors: 6,
  pathomit: 8,
  ltres: 1,
  qtres: 1,
  blurradius: 0,
};

export async function imageSourceToImageData(source: Blob | HTMLImageElement, maxSize = 1024): Promise<ImageData> {
  const img = source instanceof Blob ? await blobToImage(source) : source;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error("Image has no size");
  const scale = Math.min(1, maxSize / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Remove `<path …/>` elements the predicate rejects. */
function filterPaths(svg: string, keep: (attrs: Record<string, string>) => boolean): string {
  return svg.replace(/<path\b([^>]*)\/>/gi, (m, attrStr: string) => {
    const attrs: Record<string, string> = {};
    for (const a of attrStr.matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2];
    return keep(attrs) ? m : "";
  });
}

function isBackgroundLayer(attrs: Record<string, string>, whiteThreshold: number): boolean {
  const opacity = attrs.opacity !== undefined ? parseFloat(attrs.opacity) : 1;
  if (opacity <= 0.05) return true;
  const hex = normalizeColor(attrs.fill ?? "");
  if (!hex) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
}

/** Clean up imagetracer output: no <desc>, hex colours, optional background removal, no dangling strokes. */
export function cleanTracedSvg(svg: string, opts: { removeBackground?: boolean; whiteThreshold?: number } = {}): string {
  let out = svg.replace(/<desc>[\s\S]*?<\/desc>/gi, "");
  if (opts.removeBackground) out = filterPaths(out, (a) => !isBackgroundLayer(a, opts.whiteThreshold ?? 235));
  // rgb(…) → hex for readable, mappable colours
  out = out.replace(/(fill|stroke)="rgb\(([^)]+)\)"/gi, (_m, k: string, v: string) => `${k}="${normalizeColor(`rgb(${v})`) ?? `rgb(${v})`}"`);
  // imagetracer writes opacity="1" on every path; drop the noise
  out = out.replace(/\sopacity="1(\.0+)?"/g, "");
  // remove strokes when width is 0
  out = out.replace(/\sstroke="[^"]*"\sstroke-width="0"/g, "");
  out = out.replace(/<svg\b([^>]*)>/i, (m, attrs: string) => (/xmlns=/.test(attrs) ? m : `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>`));
  return out.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

/** Trace a raster image into an SVG string. Heavy lifting runs in imagetracerjs (dynamically imported). */
export async function vectorizeImage(source: Blob | HTMLImageElement, options: VectorizeOptions = {}): Promise<VectorizeResult> {
  const { default: ImageTracer } = await import("imagetracerjs");
  const preset = options.preset ?? DEFAULT_VECTORIZE.preset;
  const base = { ...(ImageTracer.optionpresets[preset] ?? {}) };
  const imgd = await imageSourceToImageData(source, Math.min(1024, options.maxSize ?? 1024));
  const traceOptions = {
    ...base,
    numberofcolors: options.numberofcolors ?? base.numberofcolors ?? DEFAULT_VECTORIZE.numberofcolors,
    pathomit: options.pathomit ?? base.pathomit ?? DEFAULT_VECTORIZE.pathomit,
    ltres: options.ltres ?? base.ltres ?? DEFAULT_VECTORIZE.ltres,
    qtres: options.qtres ?? base.qtres ?? DEFAULT_VECTORIZE.qtres,
    blurradius: options.blurradius ?? base.blurradius ?? DEFAULT_VECTORIZE.blurradius,
    strokewidth: options.strokewidth ?? base.strokewidth ?? 1,
    roundcoords: options.roundcoords ?? 1,
    viewbox: true,
    desc: false,
  };
  const raw = ImageTracer.imagedataToSVG(imgd, traceOptions);
  let svg = cleanTracedSvg(raw, { removeBackground: options.removeBackground ?? true, whiteThreshold: options.whiteThreshold });
  svg = setRootAttrs(svg, { width: imgd.width, height: imgd.height, viewBox: `0 0 ${imgd.width} ${imgd.height}` });
  if (options.fit ?? true) svg = fitViewBox(svg, Math.round(Math.max(imgd.width, imgd.height) * 0.02));
  const paths = (svg.match(/<path\b/gi) ?? []).length;
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number);
  return {
    svg,
    width: vb?.[2] ?? imgd.width,
    height: vb?.[3] ?? imgd.height,
    colors: collectColors(svg),
    paths,
  };
}

/**
 * ML background removal. Downloads ONNX assets from the imgly CDN on first use,
 * so it throws offline — callers should toast and continue with the original.
 */
export async function removeImageBackground(blob: Blob, onProgress?: (fraction: number, label: string) => void): Promise<Blob> {
  const mod = await import("@imgly/background-removal");
  const removeBackground = mod.removeBackground ?? mod.default;
  return removeBackground(blob, {
    device: "cpu",
    model: "isnet_quint8",
    output: { format: "image/png", quality: 1 },
    progress: (key: string, current: number, total: number) => onProgress?.(total ? current / total : 0, key),
  });
}

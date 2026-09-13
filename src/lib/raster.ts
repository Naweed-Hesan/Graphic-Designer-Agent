"use client";
/** SVG → canvas/PNG helpers shared by the logo, motion, mockup and export labs. */
import { loadImage, svgToDataUrl } from "@/lib/utils";

export interface SvgSize {
  width: number;
  height: number;
}

/** Reads the intrinsic size from viewBox/width/height; defaults to 512×512. */
export function svgSize(svg: string): SvgSize {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] };
  const w = parseFloat(/\swidth\s*=\s*"([\d.]+)/i.exec(svg)?.[1] ?? "");
  const h = parseFloat(/\sheight\s*=\s*"([\d.]+)/i.exec(svg)?.[1] ?? "");
  if (w > 0 && h > 0) return { width: w, height: h };
  return { width: 512, height: 512 };
}

/** Ensures the SVG has explicit width/height so browsers rasterise it predictably. */
export function normalizeSvg(svg: string, width?: number, height?: number): string {
  const size = svgSize(svg);
  const w = width ?? size.width;
  const h = height ?? size.height;
  let out = svg.trim();
  if (!/^<\?xml/.test(out) && !/xmlns=/.test(out)) out = out.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  out = out.replace(/<svg([^>]*?)\s(width|height)="[^"]*"/gi, "<svg$1").replace(/<svg([^>]*?)\s(width|height)="[^"]*"/gi, "<svg$1");
  if (!/viewBox=/i.test(out)) out = out.replace(/<svg/i, `<svg viewBox="0 0 ${size.width} ${size.height}"`);
  return out.replace(/<svg/i, `<svg width="${w}" height="${h}"`);
}

export async function svgToImage(svg: string, width?: number, height?: number): Promise<HTMLImageElement> {
  return loadImage(svgToDataUrl(normalizeSvg(svg, width, height)));
}

/** Rasterise an SVG to a canvas, fitting it inside width×height with padding and optional background. */
export async function svgToCanvas(svg: string, width: number, height: number, opts: { background?: string; padding?: number; fit?: "contain" | "cover" } = {}): Promise<HTMLCanvasElement> {
  const { background, padding = 0, fit = "contain" } = opts;
  const size = svgSize(svg);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d")!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const availW = canvas.width - padding * 2;
  const availH = canvas.height - padding * 2;
  const scale = fit === "contain" ? Math.min(availW / size.width, availH / size.height) : Math.max(availW / size.width, availH / size.height);
  const dw = size.width * scale;
  const dh = size.height * scale;
  const img = await svgToImage(svg, Math.ceil(dw), Math.ceil(dh));
  ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  return canvas;
}

export async function svgToPngBlob(svg: string, width: number, height?: number, opts: { background?: string; padding?: number } = {}): Promise<Blob> {
  const size = svgSize(svg);
  const h = height ?? Math.round((width * size.height) / size.width);
  const canvas = await svgToCanvas(svg, width, h, opts);
  return canvasToBlob(canvas, "image/png");
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality));
}

export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Builds a Windows .ico from PNG blobs (16/32/48…). */
export async function pngsToIco(pngs: { size: number; blob: Blob }[]): Promise<Blob> {
  const bufs = await Promise.all(pngs.map((p) => p.blob.arrayBuffer()));
  const headerSize = 6 + 16 * pngs.length;
  const total = headerSize + bufs.reduce((n, b) => n + b.byteLength, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, pngs.length, true);
  let offset = headerSize;
  pngs.forEach((p, i) => {
    const o = 6 + i * 16;
    out[o] = p.size >= 256 ? 0 : p.size;
    out[o + 1] = p.size >= 256 ? 0 : p.size;
    out[o + 2] = 0;
    out[o + 3] = 0;
    dv.setUint16(o + 4, 1, true);
    dv.setUint16(o + 6, 32, true);
    dv.setUint32(o + 8, bufs[i].byteLength, true);
    dv.setUint32(o + 12, offset, true);
    out.set(new Uint8Array(bufs[i]), offset);
    offset += bufs[i].byteLength;
  });
  return new Blob([out], { type: "image/x-icon" });
}

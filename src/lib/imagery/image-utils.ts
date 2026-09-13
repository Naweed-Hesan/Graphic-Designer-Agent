/**
 * Browser image helpers for the Imagery lab: reading uploads, resizing and
 * converting between Blob / data URL / HTMLImageElement. No React.
 */
import { blobToDataUrl, dataUrlToBlob, loadImage } from "@/lib/utils";

export { blobToDataUrl, dataUrlToBlob };

export interface ImageFileInfo {
  blob: Blob;
  name: string;
  mime: string;
  width: number;
  height: number;
  kind: "image" | "svg";
  /** SVG source when kind === "svg" */
  svg?: string;
}

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return EXT_MIME[ext] ?? "";
}

/** Decodes a blob into an <img>; the temporary object URL is revoked shortly after load. */
export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Reads the intrinsic pixel size of a raster blob (fast path via createImageBitmap). */
export async function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function" && blob.type !== "image/svg+xml") {
    try {
      const bmp = await createImageBitmap(blob);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close();
      return size;
    } catch {
      // fall through to the <img> path (e.g. unsupported codec in createImageBitmap)
    }
  }
  const img = await blobToImage(blob);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/** Intrinsic size of an SVG document from viewBox or width/height; 512² when unknown. */
export function svgTextSize(svg: string): { width: number; height: number } {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: Math.round(vb[2]), height: Math.round(vb[3]) };
  const w = parseFloat(/\swidth\s*=\s*"([\d.]+)/i.exec(svg)?.[1] ?? "");
  const h = parseFloat(/\sheight\s*=\s*"([\d.]+)/i.exec(svg)?.[1] ?? "");
  if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
  return { width: 512, height: 512 };
}

/** Turns an uploaded File into everything `addAsset` needs, including pixel dimensions. */
export async function fileToImageAsset(file: File): Promise<ImageFileInfo> {
  const mime = file.type || guessMime(file.name);
  if (mime === "image/svg+xml") {
    const svg = await file.text();
    const { width, height } = svgTextSize(svg);
    return { blob: new Blob([svg], { type: mime }), name: file.name, mime, width, height, kind: "svg", svg };
  }
  if (!mime.startsWith("image/")) throw new Error(`${file.name} is not an image`);
  const blob = file.slice(0, file.size, mime);
  const { width, height } = await readImageSize(blob);
  return { blob, name: file.name, mime, width, height, kind: "image" };
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), type, quality));
}

/**
 * Scales a raster so its longest edge is at most `maxSize`. Returns the original
 * blob untouched when it already fits and no re-encode was requested.
 */
export async function resizeImageBlob(blob: Blob, maxSize: number, opts: { mime?: string; quality?: number } = {}): Promise<Blob> {
  const img = await blobToImage(blob);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  if (scale === 1 && !opts.mime) return blob;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const mime = opts.mime ?? (blob.type === "image/jpeg" ? "image/jpeg" : "image/png");
  return canvasToBlob(canvas, mime, opts.quality);
}

/** Data URL with the long edge capped — keeps edit / image-to-image requests small. */
export async function blobToDataUrlResized(blob: Blob, maxSize = 1024): Promise<string> {
  return blobToDataUrl(await resizeImageBlob(blob, maxSize));
}

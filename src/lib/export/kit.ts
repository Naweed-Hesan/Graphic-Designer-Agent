"use client";
/**
 * Brand kit builder: assembles every deliverable into a clear folder structure
 * and zips it. Rendering (PNG/ICO/social) happens on canvas, so this module is
 * browser-only; text formats come from the pure exporters.
 */
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { buildGuidelines, type LogoRef } from "@/lib/guidelines/model";
import { renderStandaloneHtml, type PageSize } from "@/lib/guidelines/html";
import { canvasToBlob, pngsToIco, svgSize, svgToCanvas } from "@/lib/raster";
import { paletteColor } from "@/lib/logo/assets";
import { blobToDataUrl, slugify } from "@/lib/utils";
import { extFor } from "./bundle";
import { genomeToDtcg, genomeToTokensStudio, paletteToAse, paletteToCss, paletteToScss, paletteToTailwind, typographyToCss } from "./tokens";
import { fontsTxt, kitReadme, paletteToGpl, siteWebmanifest } from "./formats";
import { renderSocialAsset, SOCIAL_SPECS } from "./social";

export type KitGroupId = "guidelines" | "logo" | "favicon" | "color" | "typography" | "social" | "imagery" | "mockups" | "motion";

export interface KitGroup {
  id: KitGroupId;
  label: string;
  folder: string;
  description: string;
}

export const KIT_GROUPS: KitGroup[] = [
  { id: "guidelines", label: "Guidelines", folder: "guidelines/", description: "Self-contained HTML brand book, print-ready." },
  { id: "logo", label: "Logo", folder: "logo/svg, logo/png", description: "Every variant as SVG and transparent PNG at @1x, @2x and @4x." },
  { id: "favicon", label: "Favicons", folder: "logo/favicon/", description: "favicon.ico, apple-touch-icon, Android icons and site.webmanifest." },
  { id: "color", label: "Colour tokens", folder: "color/", description: "CSS, SCSS, Tailwind, DTCG, Tokens Studio, ASE and GPL." },
  { id: "typography", label: "Typography", folder: "typography/", description: "typography.css with the scale, plus fonts.txt with links and licensing." },
  { id: "social", label: "Social kit", folder: "social/", description: "Avatars at 400² and 800²; LinkedIn, X, YouTube and Facebook covers." },
  { id: "imagery", label: "Imagery", folder: "imagery/", description: "Reference images and on-brand generated imagery." },
  { id: "mockups", label: "Mockups", folder: "mockups/", description: "Application mockups from the Mockups lab." },
  { id: "motion", label: "Motion", folder: "motion/", description: "Logo animations and brand video renders." },
];

export interface KitOptions {
  include: Record<KitGroupId, boolean>;
  pageSize?: PageSize;
}

export const DEFAULT_KIT_OPTIONS: KitOptions = {
  include: { guidelines: true, logo: true, favicon: true, color: true, typography: true, social: true, imagery: true, mockups: true, motion: true },
  pageSize: "A4",
};

export interface KitFile {
  path: string;
  data: Blob | string | Uint8Array;
  group: KitGroupId | "root";
  bytes: number;
}

export interface KitProgress {
  phase: "render" | "zip";
  /** 0–100 */
  percent: number;
  label: string;
}

const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
function bytesOf(data: Blob | string | Uint8Array): number {
  if (typeof data === "string") return enc ? enc.encode(data).byteLength : data.length;
  if (data instanceof Uint8Array) return data.byteLength;
  return data.size;
}

function file(path: string, data: Blob | string | Uint8Array, group: KitGroupId | "root"): KitFile {
  return { path, data, group, bytes: bytesOf(data) };
}

/** Fit a logo into a box of `longest` px on its longer side. */
function fitSize(svg: string, longest: number): { width: number; height: number } {
  const s = svgSize(svg);
  const ratio = s.width / s.height;
  return ratio >= 1 ? { width: longest, height: Math.round(longest / ratio) } : { width: Math.round(longest * ratio), height: longest };
}

async function pngOf(svg: string, longest: number, background?: string, padding = 0): Promise<Blob> {
  const { width, height } = fitSize(svg, longest);
  const canvas = await svgToCanvas(svg, width, height, { background, padding });
  return canvasToBlob(canvas, "image/png");
}

function uniqueNamer() {
  const seen = new Map<string, number>();
  return (base: string, ext: string) => {
    const key = `${base}${ext}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return n ? `${base}-${n + 1}${ext}` : key;
  };
}

function assetFile(a: Asset, name: (base: string, ext: string) => string): { path: string; data: Blob | string } {
  const ext = extFor(a.mime, a.name) || (a.kind === "svg" ? ".svg" : a.kind === "video" ? ".mp4" : ".bin");
  const base = slugify(a.name.replace(/\.[a-z0-9]+$/i, "")) || a.id;
  return { path: name(base, ext), data: a.kind === "svg" && a.svg ? a.svg : a.blob };
}

/**
 * Build every file of the kit (all groups), so the UI can show live counts and
 * sizes and zip a filtered subset instantly. `onProgress` reports the render phase.
 */
export async function buildKitFiles(genome: Genome, assets: Asset[], options: Partial<KitOptions> = {}, onProgress?: (p: KitProgress) => void): Promise<KitFile[]> {
  const files: KitFile[] = [];
  const doc = buildGuidelines(genome, assets);
  const logoSection = doc.sections.find((s) => s.kind === "logo");
  const variants: LogoRef[] = logoSection?.variants ?? [];
  const placeholder = logoSection?.placeholder ?? true;
  const favSource = variants.find((v) => v.key === "favicon") ?? variants.find((v) => v.key === "mark") ?? variants[0];
  const imagery = assets.filter((a) => a.kind === "image" && (a.stage === "imagery" || genome.visual.imagery.referenceAssetIds.includes(a.id)));
  const mockups = assets.filter((a) => a.kind === "image" && a.stage === "mockups");
  const motion = assets.filter((a) => a.kind === "video" || (a.stage === "motion" && (a.kind === "image" || a.kind === "file")));

  const total = 1 + variants.length * 4 + 6 + SOCIAL_SPECS.length + 3;
  let done = 0;
  const tick = (label: string) => {
    done++;
    onProgress?.({ phase: "render", percent: Math.min(99, Math.round((done / total) * 100)), label });
  };

  /* guidelines */
  onProgress?.({ phase: "render", percent: 0, label: "Rendering guidelines" });
  const html = await renderStandaloneHtml(doc, {
    inlineAssets: true,
    pageSize: options.pageSize ?? "A4",
    resolveAsset: async (ref) => {
      const a = assets.find((x) => x.id === ref.assetId);
      return a ? blobToDataUrl(a.blob) : undefined;
    },
  });
  files.push(file("guidelines/guidelines.html", html, "guidelines"));
  tick("Guidelines");

  /* logo */
  for (const v of variants) {
    const base = slugify(v.key);
    files.push(file(`logo/svg/${base}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${v.svg}`, "logo"));
    tick(`Logo ${v.label} (SVG)`);
    for (const [scale, longest] of [
      ["1x", 512],
      ["2x", 1024],
      ["4x", 2048],
    ] as const) {
      files.push(file(`logo/png/${base}@${scale}.png`, await pngOf(v.svg, longest), "logo"));
      tick(`Logo ${v.label} @${scale}`);
    }
  }

  /* favicon */
  if (favSource) {
    const icoPngs: { size: number; blob: Blob }[] = [];
    for (const size of [16, 32, 48]) {
      icoPngs.push({ size, blob: await pngOf(favSource.svg, size) });
      tick(`Favicon ${size}px`);
    }
    files.push(file("logo/favicon/favicon.ico", await pngsToIco(icoPngs), "favicon"));
    const bg = paletteColor(genome, "background", "#ffffff");
    files.push(file("logo/favicon/apple-touch-icon.png", await pngOf(favSource.svg, 180, bg, 18), "favicon"));
    tick("Apple touch icon");
    files.push(file("logo/favicon/android-chrome-192x192.png", await pngOf(favSource.svg, 192), "favicon"));
    tick("Android icon 192");
    files.push(file("logo/favicon/android-chrome-512x512.png", await pngOf(favSource.svg, 512), "favicon"));
    tick("Android icon 512");
    files.push(file("logo/favicon/site.webmanifest", siteWebmanifest(genome), "favicon"));
    files.push(
      file(
        "logo/favicon/snippet.html",
        `<link rel="icon" href="/favicon.ico" sizes="32x32">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${paletteColor(genome, "primary", "#1f1f1f")}">\n`,
        "favicon",
      ),
    );
  }

  /* colour */
  files.push(file("color/tokens.dtcg.json", JSON.stringify(genomeToDtcg(genome), null, 2), "color"));
  files.push(file("color/tokens-studio.json", JSON.stringify(genomeToTokensStudio(genome), null, 2), "color"));
  files.push(file("color/palette.css", paletteToCss(genome), "color"));
  files.push(file("color/palette.scss", paletteToScss(genome), "color"));
  files.push(file("color/tailwind.txt", paletteToTailwind(genome), "color"));
  files.push(file("color/palette.ase", paletteToAse(genome), "color"));
  files.push(file("color/palette.gpl", paletteToGpl(genome), "color"));
  tick("Colour tokens");

  /* typography */
  files.push(file("typography/typography.css", typographyToCss(genome), "typography"));
  files.push(file("typography/fonts.txt", fontsTxt(genome), "typography"));
  tick("Typography");

  /* social */
  for (const spec of SOCIAL_SPECS) {
    const canvas = await renderSocialAsset(genome, assets, spec);
    files.push(file(`social/${spec.file}`, await canvasToBlob(canvas, "image/png"), "social"));
    tick(`Social ${spec.label}`);
  }

  /* assets */
  const nameImagery = uniqueNamer();
  for (const a of imagery) {
    const f = assetFile(a, nameImagery);
    files.push(file(`imagery/${f.path}`, f.data, "imagery"));
  }
  const nameMock = uniqueNamer();
  for (const a of mockups) {
    const f = assetFile(a, nameMock);
    files.push(file(`mockups/${f.path}`, f.data, "mockups"));
  }
  const nameMotion = uniqueNamer();
  for (const a of motion) {
    const f = assetFile(a, nameMotion);
    files.push(file(`motion/${f.path}`, f.data, "motion"));
  }
  tick("Project assets");

  /* root */
  files.push(file("genome.json", JSON.stringify(genome, null, 2), "root"));
  const include = { ...DEFAULT_KIT_OPTIONS.include, ...(options.include ?? {}) };
  const counts = summarizeKit(files);
  files.unshift(
    file(
      "README.md",
      kitReadme(genome, {
        placeholderLogo: placeholder,
        generatedOn: new Date().toISOString().slice(0, 10),
        groups: KIT_GROUPS.map((g) => ({ id: g.id, label: g.label, included: include[g.id], count: counts[g.id]?.count ?? 0 })),
      }),
      "root",
    ),
  );
  onProgress?.({ phase: "render", percent: 100, label: "Rendered" });
  return files;
}

export function summarizeKit(files: KitFile[]): Record<string, { count: number; bytes: number }> {
  const out: Record<string, { count: number; bytes: number }> = {};
  for (const f of files) {
    const s = (out[f.group] ??= { count: 0, bytes: 0 });
    s.count++;
    s.bytes += f.bytes;
  }
  return out;
}

export function filterKitFiles(files: KitFile[], options: Partial<KitOptions>): KitFile[] {
  const include = { ...DEFAULT_KIT_OPTIONS.include, ...(options.include ?? {}) };
  return files.filter((f) => f.group === "root" || include[f.group]);
}

/** Zip a list of kit files (jszip is loaded on demand). */
export async function zipKitFiles(files: KitFile[], onProgress?: (p: KitProgress) => void): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.data instanceof Uint8Array ? new Blob([f.data as BlobPart]) : f.data, { binary: typeof f.data !== "string" });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (meta) => {
    onProgress?.({ phase: "zip", percent: Math.round(meta.percent), label: meta.currentFile ? `Packing ${meta.currentFile}` : "Packing" });
  });
}

/** Everything in one call: build, filter by the options, zip. */
export async function buildBrandKit(genome: Genome, assets: Asset[], options: Partial<KitOptions> = {}, onProgress?: (p: KitProgress) => void): Promise<Blob> {
  const files = await buildKitFiles(genome, assets, options, onProgress);
  return zipKitFiles(filterKitFiles(files, options), onProgress);
}

export function kitFilename(genome: Genome): string {
  return `${slugify(genome.name)}-brand-kit.zip`;
}

"use client";
import { safeParseGenome, type Genome } from "@/lib/genome/schema";
import { db, saveProject, type Asset } from "@/lib/db";
import { uid } from "@/lib/utils";

/**
 * A `.ligature.zip` bundle = genome.json + assets/ + assets.json (metadata).
 * It is the portable, lossless form of a project.
 */
export async function exportProjectBundle(genome: Genome, assets: Asset[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("genome.json", JSON.stringify(genome, null, 2));
  const meta = assets.map(({ blob: _b, ...rest }) => {
    void _b;
    return { ...rest, file: `assets/${rest.id}${extFor(rest.mime, rest.name) || ".bin"}` };
  });
  zip.file("assets.json", JSON.stringify(meta, null, 2));
  for (const a of assets) {
    const ext = extFor(a.mime, a.name) || ".bin";
    zip.file(`assets/${a.id}${ext}`, a.kind === "svg" && a.svg ? a.svg : a.blob);
  }
  zip.file("README.txt", `Ligature project bundle for "${genome.name}". Import it from the Ligature dashboard. genome.json is the Brand Genome; assets/ holds every saved asset.`);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/**
 * Imports a bundle as a NEW project: every asset gets a fresh id (so importing a
 * backup next to the original never re-parents the original's assets) and every
 * asset reference inside the Genome is rewritten to match.
 */
export async function importBrandBundle(file: File): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const genomeText = await zip.file("genome.json")?.async("string");
  if (!genomeText) throw new Error("Bundle has no genome.json");
  const parsed = safeParseGenome(JSON.parse(genomeText));
  if (!parsed.ok) throw new Error(parsed.error);
  const genome = parsed.genome;
  genome.id = uid(10);
  const metaText = await zip.file("assets.json")?.async("string");
  const metas = metaText ? (JSON.parse(metaText) as (Omit<Asset, "blob"> & { file?: string })[]) : [];

  const idMap = new Map<string, string>();
  for (const m of metas) idMap.set(m.id, uid(12));
  const remap = (id: string | undefined) => (id ? (idMap.get(id) ?? id) : id);

  const logo = genome.visual.logo;
  logo.concepts = logo.concepts.map((id) => remap(id)!);
  logo.markAssetId = remap(logo.markAssetId);
  logo.wordmarkAssetId = remap(logo.wordmarkAssetId);
  logo.variants = Object.fromEntries(Object.entries(logo.variants).map(([k, v]) => [k, remap(v)!]));
  genome.visual.imagery.referenceAssetIds = genome.visual.imagery.referenceAssetIds.map((id) => remap(id)!);
  for (const slot of ["display", "body", "mono"] as const) {
    const f = genome.visual.typography[slot];
    if (f.assetId) f.assetId = remap(f.assetId);
  }

  await saveProject(genome);
  let missing = 0;
  for (const m of metas) {
    const entry = (m.file ? zip.file(m.file) : null) ?? zip.file(new RegExp(`^assets/${m.id}(\\.|$)`))[0];
    if (!entry) {
      missing++;
      continue;
    }
    const blob = await entry.async("blob");
    const typed = new Blob([blob], { type: m.mime });
    const { file: _f, ...rest } = m;
    void _f;
    await db().assets.put({ ...rest, id: idMap.get(m.id)!, parentId: remap(m.parentId), projectId: genome.id, blob: typed, svg: m.kind === "svg" ? await entry.async("string") : undefined });
  }
  if (missing) console.warn(`Bundle import: ${missing} asset file(s) were missing from the archive`);
  return genome.id;
}

export function extFor(mime: string, name = ""): string {
  const fromName = /\.[a-z0-9]+$/i.exec(name)?.[0];
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const map: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm", "font/ttf": ".ttf", "application/json": ".json" };
  return map[mime] ?? "";
}

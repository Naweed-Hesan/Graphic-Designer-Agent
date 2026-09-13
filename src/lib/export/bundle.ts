"use client";
import JSZip from "jszip";
import { safeParseGenome, type Genome } from "@/lib/genome/schema";
import { db, saveProject, type Asset } from "@/lib/db";
import { uid } from "@/lib/utils";

/**
 * A `.ligature.zip` bundle = genome.json + assets/ + assets.json (metadata).
 * It is the portable, lossless form of a project.
 */
export async function exportProjectBundle(genome: Genome, assets: Asset[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file("genome.json", JSON.stringify(genome, null, 2));
  const meta = assets.map(({ blob: _b, ...rest }) => {
    void _b;
    return rest;
  });
  zip.file("assets.json", JSON.stringify(meta, null, 2));
  const folder = zip.folder("assets")!;
  for (const a of assets) {
    const ext = extFor(a.mime, a.name);
    folder.file(`${a.id}${ext}`, a.kind === "svg" && a.svg ? a.svg : a.blob);
  }
  zip.file("README.txt", `Ligature project bundle for "${genome.name}". Import it from the Ligature dashboard. genome.json is the Brand Genome; assets/ holds every saved asset.`);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function importBrandBundle(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const genomeText = await zip.file("genome.json")?.async("string");
  if (!genomeText) throw new Error("Bundle has no genome.json");
  const parsed = safeParseGenome(JSON.parse(genomeText));
  if (!parsed.ok) throw new Error(parsed.error);
  const genome = parsed.genome;
  const oldId = genome.id;
  genome.id = uid(10);
  const metaText = await zip.file("assets.json")?.async("string");
  const metas = metaText ? (JSON.parse(metaText) as Omit<Asset, "blob">[]) : [];
  await saveProject(genome);
  for (const m of metas) {
    const entry = zip.file(new RegExp(`^assets/${m.id}\\.`))[0];
    if (!entry) continue;
    const blob = await entry.async("blob");
    const typed = new Blob([blob], { type: m.mime });
    await db().assets.put({ ...m, projectId: genome.id, blob: typed, svg: m.kind === "svg" ? await entry.async("string") : undefined });
  }
  void oldId;
  return genome.id;
}

export function extFor(mime: string, name = ""): string {
  const fromName = /\.[a-z0-9]+$/i.exec(name)?.[0];
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const map: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm", "font/ttf": ".ttf", "application/json": ".json" };
  return map[mime] ?? "";
}

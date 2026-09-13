"use client";
import * as React from "react";
import { ImagePlus, Plus, Replace, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Dialog, Field, Select, Spinner } from "@/components/ui";
import type { BrandColor } from "@/lib/genome/schema";
import { assetUrl, useProject } from "@/lib/store/project";
import { assignRoles, dominantHues, extractPalette, type ExtractedColor } from "@/lib/color/extract";
import { applySuggestions } from "@/lib/color/harmonies";
import { nameColors } from "@/lib/color/names";
import { bestTextOn } from "@/lib/color/contrast";
import { cn, loadImage, uid } from "@/lib/utils";
import { BodyPortal, editPalette, pct } from "./shared";

interface Source {
  url: string;
  name: string;
}

export function ExtractDialog({ colors, onClose }: { colors: BrandColor[]; onClose: () => void }) {
  const assets = useProject((s) => s.assets);
  const images = assets.filter((a) => a.kind === "image");
  const [source, setSource] = React.useState<Source | null>(null);
  const [count, setCount] = React.useState(6);
  const [busy, setBusy] = React.useState(false);
  const [extracted, setExtracted] = React.useState<ExtractedColor[] | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const ownedUrl = React.useRef<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(
    () => () => {
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    },
    [],
  );

  const run = async (src: Source, n: number) => {
    setBusy(true);
    try {
      const img = await loadImage(src.url);
      const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const result = extractPalette(data, n);
      setExtracted(result);
      if (!result.length) toast.message("No opaque pixels found in that image");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the image");
      setExtracted(null);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Drop an image file (PNG, JPG, WebP…)");
      return;
    }
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = URL.createObjectURL(file);
    ownedUrl.current = url;
    const src = { url, name: file.name };
    setSource(src);
    void run(src, count);
  };

  const pickAsset = (id: string) => {
    const a = images.find((x) => x.id === id);
    if (!a) return;
    const src = { url: assetUrl(a), name: a.name };
    setSource(src);
    void run(src, count);
  };

  const names = extracted ? nameColors(extracted.map((c) => c.hex)) : [];
  const existing = new Set(colors.map((c) => c.hex.toLowerCase()));
  const hues = extracted ? dominantHues(extracted) : [];

  const addOne = (hex: string, name: string) => {
    editPalette(
      (p) => {
        p.colors.push({ id: uid(6), name, hex, role: "custom", usage: `Extracted from ${source?.name ?? "image"}`, locked: false });
      },
      `Added ${name} from ${source?.name ?? "image"}`,
    );
    toast.success(`${name} added`);
  };

  const addAll = () => {
    if (!extracted) return;
    const fresh = extracted.filter((c) => !existing.has(c.hex.toLowerCase()));
    editPalette(
      (p) => {
        fresh.forEach((c, i) =>
          p.colors.push({ id: uid(6), name: names[extracted.indexOf(c)] ?? `Colour ${i + 1}`, hex: c.hex, role: "custom", usage: `Extracted from ${source?.name ?? "image"}`, locked: false }),
        );
      },
      `Added ${fresh.length} colours extracted from ${source?.name ?? "image"}`,
    );
    toast.success(`${fresh.length} colours added`);
    onClose();
  };

  const replace = () => {
    if (!extracted) return;
    const roles = assignRoles(extracted);
    const lockedCount = colors.filter((c) => c.locked).length;
    editPalette(
      (p, g) => {
        const kept = p.colors.filter((c) => c.locked);
        const keptIds = new Set(kept.map((c) => c.id));
        for (const id of Object.keys(p.dark)) if (!keptIds.has(id)) delete p.dark[id];
        p.colors = applySuggestions(kept, roles, () => uid(6));
        if (g.stages.color === "todo") g.stages.color = "in-progress";
      },
      `Replaced palette with colours extracted from ${source?.name ?? "image"}`,
    );
    toast.success(lockedCount ? `Palette replaced — ${lockedCount} locked colour${lockedCount > 1 ? "s" : ""} kept` : "Palette replaced");
    onClose();
  };

  return (
    <BodyPortal>
      <Dialog open onClose={onClose} title="Extract from image" description="Drop a photo, poster or moodboard. Colours are clustered in OKLab and ranked by how much of the image they cover." wide>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 min-w-0">
            {source ? (
              <div className="inset overflow-hidden checker relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.url} alt={source.name} className="w-full max-h-64 object-contain" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                  <span className="rounded-md bg-black/60 text-white text-[11px] px-2 py-1 truncate">{source.name}</span>
                  <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> Change
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) pickFile(f);
                }}
                className={cn(
                  "inset grid-dots flex flex-col items-center justify-center gap-2 h-52 text-center cursor-pointer transition-colors",
                  dragOver ? "border-accent bg-accent-soft/40" : "hover:border-line-strong",
                )}
              >
                <ImagePlus className="h-7 w-7 text-fg-subtle" />
                <div className="text-sm font-medium">Drop an image or click to upload</div>
                <div className="text-xs text-fg-muted">PNG, JPG, WebP, SVG — stays in your browser</div>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload image"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            <div className="flex items-end gap-3">
              <Field label="Colours" className="w-28">
                <Select
                  value={count}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setCount(n);
                    if (source) void run(source, n);
                  }}
                  aria-label="Number of colours"
                >
                  {[3, 4, 5, 6, 7, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              {busy ? (
                <span className="inline-flex items-center gap-2 text-sm text-fg-muted h-9">
                  <Spinner /> Clustering…
                </span>
              ) : null}
            </div>
            {images.length ? (
              <div>
                <div className="label mb-2">Project images</div>
                <div className="grid grid-cols-4 gap-2">
                  {images.slice(0, 12).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => pickAsset(a.id)}
                      className="aspect-square inset overflow-hidden checker hover:border-accent focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      title={a.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assetUrl(a)} alt={a.name} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-fg-subtle">Images generated in the Logo or Imagery labs will appear here for one-click extraction.</p>
            )}
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            {extracted && extracted.length ? (
              <>
                <div className="flex h-10 rounded-md overflow-hidden border border-line">
                  {extracted.map((c) => (
                    <div key={c.hex} style={{ background: c.hex, flexGrow: Math.max(c.share, 0.03) }} title={`${c.hex.toUpperCase()} · ${pct(c.share)}`} />
                  ))}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {extracted.map((c, i) => {
                    const present = existing.has(c.hex.toLowerCase());
                    return (
                      <li key={c.hex} className="surface-2 flex items-center gap-3 px-2.5 py-2">
                        <span
                          className="h-9 w-9 rounded-md border border-black/10 shrink-0 flex items-center justify-center text-[10px] font-mono"
                          style={{ background: c.hex, color: bestTextOn(c.hex) }}
                        >
                          {pct(c.share)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{names[i]}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-fg-muted uppercase">{c.hex}</span>
                            <span className="h-1 flex-1 rounded-full bg-bg-inset overflow-hidden max-w-24">
                              <span className="block h-full bg-fg-subtle" style={{ width: pct(c.share) }} />
                            </span>
                          </div>
                        </div>
                        {present ? (
                          <Badge tone="success">in palette</Badge>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => addOne(c.hex, names[i])} title="Add to palette">
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {hues.length ? (
                  <p className="text-xs text-fg-muted">
                    Dominant hues:{" "}
                    {hues
                      .slice(0, 3)
                      .map((h) => `${h.hue}° (${pct(h.share)})`)
                      .join(" · ")}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <Button variant="secondary" onClick={addAll} disabled={extracted.every((c) => existing.has(c.hex.toLowerCase()))}>
                    <Plus className="h-4 w-4" /> Add all
                  </Button>
                  <Button onClick={replace} title="Assign roles automatically and replace unlocked colours">
                    <Replace className="h-4 w-4" /> Replace palette
                  </Button>
                </div>
              </>
            ) : (
              <div className="inset flex-1 min-h-52 flex items-center justify-center text-sm text-fg-muted text-center p-6">
                {busy ? "Reading pixels…" : "Extracted colours appear here, ranked by coverage."}
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </BodyPortal>
  );
}

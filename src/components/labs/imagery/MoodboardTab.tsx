"use client";
import * as React from "react";
import { Check, Download, Images, LayoutGrid, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, Field, Input, SectionHeader, Select, Slider, Spinner } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { Asset } from "@/lib/db";
import { composeMoodboard } from "@/lib/imagery/moodboard";
import { blobToImage, canvasToBlob } from "@/lib/imagery/image-utils";
import { bestTextOn } from "@/lib/color/contrast";
import { ensureFont, fontStack } from "@/lib/type/fonts";
import { cn, downloadBlob, slugify } from "@/lib/utils";
import { AssetImage, Segmented, markImageryInProgress, useImageryImages, useReferenceIds } from "./shared";

interface Preview {
  url: string;
  blob: Blob;
  width: number;
  height: number;
}

async function awaitFont(font: string) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.race([document.fonts.load(`500 48px ${font}`), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // Font unavailable (offline) — the canvas falls back to the stack's next family.
  }
}

export function MoodboardTab({ picks, setPicks }: { picks: string[]; setPicks: (ids: string[]) => void }) {
  const genome = useProject((s) => s.genome);
  const addAsset = useProject((s) => s.addAsset);
  const images = useImageryImages(true);
  const refs = useReferenceIds();
  const [columns, setColumns] = React.useState(3);
  const [gap, setGap] = React.useState(24);
  const [radius, setRadius] = React.useState(8);
  const [width, setWidth] = React.useState(1600);
  const [background, setBackground] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState<string | null>(null);
  const [fontChoice, setFontChoice] = React.useState<"display" | "body">("display");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Saved moodboards are excluded so a board never nests itself.
  const candidates = images.filter((a) => !a.tags.includes("moodboard"));
  const candidateIds = new Set(candidates.map((a) => a.id));
  const validPicks = picks.filter((id) => candidateIds.has(id));
  const pickKey = validPicks.join("|");

  const palette = genome?.visual.palette.colors ?? [];
  const defaultBg = palette.find((c) => c.role === "background")?.hex ?? "#FFFFFF";
  const bg = background ?? defaultBg;
  const titleText = title ?? genome?.name ?? "";
  const subtitle = genome?.strategy.tagline || "";
  const typo = genome?.visual.typography;
  const fontSpec = fontChoice === "display" ? typo?.display : typo?.body;
  const fontFamilyName = fontSpec?.family ?? "";
  const fontWeightsKey = (fontSpec?.weights ?? []).join(",");
  const fontFamily = fontSpec ? fontStack(fontSpec.family, fontSpec.fallback) : "sans-serif";

  React.useEffect(() => {
    if (!pickKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setRendering(true);
      try {
        const { assets } = useProject.getState();
        const picked = pickKey
          .split("|")
          .map((id) => assets.find((a) => a.id === id))
          .filter((a): a is Asset => Boolean(a));
        const imgs = await Promise.all(picked.map((a) => blobToImage(a.blob)));
        if (fontFamilyName) {
          ensureFont(fontFamilyName, fontWeightsKey ? fontWeightsKey.split(",").map(Number) : undefined);
          await awaitFont(fontFamily);
        }
        if (cancelled) return;
        const canvas = composeMoodboard(imgs, {
          width,
          columns,
          gap,
          background: bg,
          title: titleText || undefined,
          subtitle: titleText && subtitle ? subtitle : undefined,
          font: fontFamily,
          titleColor: bestTextOn(bg),
          radius,
        });
        const blob = await canvasToBlob(canvas);
        if (cancelled) return;
        setPreview({ url: URL.createObjectURL(blob), blob, width: canvas.width, height: canvas.height });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pickKey, columns, gap, radius, width, bg, titleText, subtitle, fontFamily, fontFamilyName, fontWeightsKey]);

  React.useEffect(() => {
    if (!preview) return;
    const url = preview.url;
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  if (!genome) return null;

  const toggle = (id: string) => setPicks(validPicks.includes(id) ? validPicks.filter((x) => x !== id) : [...validPicks, id]);
  const fileStem = `${slugify(genome.name)}-moodboard`;
  const exportPng = () => {
    if (!preview) return;
    downloadBlob(preview.blob, `${fileStem}.png`);
    toast.success("Moodboard PNG downloaded");
  };
  const save = async () => {
    if (!preview) return;
    await addAsset({
      kind: "image",
      name: `${fileStem}-${new Date().toISOString().slice(0, 10)}.png`,
      mime: "image/png",
      blob: preview.blob,
      width: preview.width,
      height: preview.height,
      stage: "imagery",
      tags: ["moodboard"],
      provider: "ligature",
    });
    markImageryInProgress();
    toast.success("Moodboard saved to the gallery");
  };

  const swatches = [...palette.map((c) => ({ hex: c.hex, name: c.name })), { hex: "#FFFFFF", name: "White" }, { hex: "#111111", name: "Near black" }];

  return (
    <div className="@container">
    <div className="grid gap-5 @4xl:grid-cols-[340px_minmax(0,1fr)] items-start">
      <Card className="flex flex-col gap-3">
        <SectionHeader title="Pick images" description={`${validPicks.length} of ${candidates.length} selected`} className="mb-0" />
        <div className="flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setPicks(refs.filter((id) => candidateIds.has(id)))} disabled={!refs.some((id) => candidateIds.has(id))} title="Select the pinned style references">
            <Star className="h-3.5 w-3.5" /> References
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPicks(candidates.map((a) => a.id))} disabled={!candidates.length}>
            All
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPicks([])} disabled={!validPicks.length}>
            Clear
          </Button>
        </div>
        {candidates.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 max-h-[60vh] overflow-y-auto pr-1" data-testid="moodboard-picker">
            {candidates.map((a) => {
              const on = validPicks.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  aria-pressed={on}
                  title={a.name}
                  className={cn("relative aspect-square rounded-md overflow-hidden border cursor-pointer transition-opacity", on ? "border-accent ring-2 ring-accent/40" : "border-line opacity-75 hover:opacity-100")}
                >
                  <AssetImage asset={a} className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-accent text-accent-fg flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  {refs.includes(a.id) && <Star className="absolute top-1 right-1 h-3.5 w-3.5 text-accent fill-current drop-shadow" />}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Images className="h-7 w-7" />} title="No images yet" description="Generate or upload images in the Gallery, then compose them here." className="p-6" />
        )}
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="@container flex flex-col gap-4">
          <SectionHeader title="Arrange" description="Equal columns, aspect preserved, shortest column fills first." className="mb-0" />
          <div className="grid gap-4 @md:grid-cols-2 @xl:grid-cols-3">
            <Field label="Columns">
              <Segmented ariaLabel="Columns" value={columns} onChange={setColumns} options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
            <Field label="Gap" hint={`${gap}px`}>
              <Slider min={0} max={64} step={4} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="mt-3" aria-label="Gap" />
            </Field>
            <Field label="Corner radius" hint={`${radius}px`}>
              <Slider min={0} max={32} step={2} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-3" aria-label="Corner radius" />
            </Field>
          </div>
          <div className="grid gap-4 @md:grid-cols-2 @xl:grid-cols-3">
            <Field label="Width">
              <Select value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Width">
                {[1200, 1600, 2000, 2400].map((w) => (
                  <option key={w} value={w}>
                    {w} px
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" hint="empty for none">
              <Input value={titleText} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" aria-label="Moodboard title" />
            </Field>
            <Field label="Title font">
              <Segmented
                ariaLabel="Title font"
                value={fontChoice}
                onChange={setFontChoice}
                options={[
                  { value: "display", label: <span className="truncate max-w-36">{genome.visual.typography.display.family}</span>, title: "Display face" },
                  { value: "body", label: <span className="truncate max-w-36">{genome.visual.typography.body.family}</span>, title: "Body face" },
                ]}
              />
            </Field>
          </div>
          <Field label="Background">
            <div className="flex flex-wrap items-center gap-2">
              {swatches.map((c) => (
                <button
                  key={`${c.hex}-${c.name}`}
                  type="button"
                  onClick={() => setBackground(c.hex)}
                  title={`${c.name} ${c.hex.toUpperCase()}`}
                  aria-label={`${c.name} background`}
                  aria-pressed={bg.toLowerCase() === c.hex.toLowerCase()}
                  className={cn("h-7 w-7 rounded-md border cursor-pointer transition-transform", bg.toLowerCase() === c.hex.toLowerCase() ? "border-accent ring-2 ring-accent/40 scale-105" : "border-line hover:border-line-strong")}
                  style={{ background: c.hex }}
                />
              ))}
              <label className="inline-flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer">
                <input type="color" value={bg} onChange={(e) => setBackground(e.target.value)} className="h-7 w-9 rounded-md border border-line bg-transparent cursor-pointer" aria-label="Custom background colour" />
                Custom
              </label>
              <span className="font-mono text-xs text-fg-subtle">{bg.toUpperCase()}</span>
            </div>
          </Field>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader
            title="Preview"
            description={preview && validPicks.length ? `${preview.width}×${preview.height} px · PNG` : "Updates live as you arrange."}
            className="mb-0"
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={exportPng} disabled={!preview || !validPicks.length || rendering} title="Download the board as a PNG">
                  <Download className="h-3.5 w-3.5" /> Export PNG
                </Button>
                <Button size="sm" onClick={save} disabled={!preview || !validPicks.length || rendering} title="Save the board into the Gallery">
                  <Save className="h-3.5 w-3.5" /> Save to assets
                </Button>
              </>
            }
          />
          {validPicks.length ? (
            <div className="relative inset overflow-hidden">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="Moodboard preview" className="block w-full h-auto" data-testid="moodboard-preview" />
              ) : (
                <div className="h-72 shimmer" />
              )}
              {rendering && (
                <div className="absolute top-2 right-2 surface-2 px-2 py-1 text-xs flex items-center gap-1.5">
                  <Spinner className="h-3 w-3" /> Rendering…
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={<LayoutGrid className="h-7 w-7" />} title="Pick a few images" description="Select images on the left — the board composes itself." />
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </Card>
      </div>
    </div>
    </div>
  );
}

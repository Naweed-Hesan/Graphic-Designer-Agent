"use client";
import * as React from "react";
import { toast } from "sonner";
import { Copy, Download, ImagePlus, RotateCcw } from "lucide-react";
import { Button, Field, Select, Slider, Spinner, Switch, Tabs } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { canvasToBlob } from "@/lib/raster";
import { cn, downloadBlob, slugify } from "@/lib/utils";
import { DEFAULT_OPTIONS, type LogoVariantChoice, type MockupScene, type MockupTemplate, type SceneOptions } from "@/lib/mockups/templates";
import { renderTemplate } from "@/lib/mockups/render";
import type { BrandColor } from "@/lib/genome/schema";

const VARIANTS: { value: LogoVariantChoice; label: string }[] = [
  { value: "auto", label: "Auto (best per template)" },
  { value: "primary", label: "Primary lockup" },
  { value: "mark", label: "Mark" },
  { value: "wordmark", label: "Wordmark" },
  { value: "mono", label: "One colour" },
];

export function MockupPreview({
  template,
  scene,
  options,
  onOptions,
  palette,
}: {
  template: MockupTemplate;
  scene: MockupScene | null;
  options: SceneOptions;
  onOptions: (patch: Partial<SceneOptions>) => void;
  palette: BrandColor[];
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const addAsset = useProject((s) => s.addAsset);
  const [busy, setBusy] = React.useState<"download" | "save" | "copy" | null>(null);

  // Paint the 2× preview whenever the template or scene changes (coalesced to one frame).
  React.useEffect(() => {
    if (!scene) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raf = requestAnimationFrame(() => {
      try {
        renderTemplate(template, scene, 2, canvas);
      } catch (e) {
        console.error(`Mockup render failed: ${template.id}`, e);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [template, scene]);

  const fileBase = () => `${slugify(scene?.text.name ?? "brand")}-${template.id}`;
  const blobOf = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) throw new Error("Nothing rendered yet");
    return canvasToBlob(canvas, "image/png");
  };

  const download = async () => {
    setBusy("download");
    try {
      downloadBlob(await blobOf(), `${fileBase()}.png`);
      toast.success("PNG downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    try {
      const blob = await blobOf();
      const canvas = canvasRef.current!;
      await addAsset({
        kind: "image",
        name: `${template.name} — ${scene?.text.name ?? "mockup"}`,
        mime: "image/png",
        blob,
        width: canvas.width,
        height: canvas.height,
        stage: "mockups",
        tags: ["mockup", template.id, template.category],
      });
      toast.success(`${template.name} saved to assets`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save asset");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      toast.error("This browser cannot copy images to the clipboard");
      return;
    }
    setBusy("copy");
    try {
      const blob = await blobOf();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Copied PNG to clipboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(null);
    }
  };

  const isDefault = JSON.stringify(options) === JSON.stringify(DEFAULT_OPTIONS);

  return (
    <div className="space-y-4">
      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div className="min-w-0">
            <div className="font-medium truncate">{template.name}</div>
            <div className="text-xs text-fg-muted truncate">
              {template.description} · {template.size.width * 2}×{template.size.height * 2} px
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={copy} disabled={!scene || !!busy} loading={busy === "copy"} title="Copy PNG to clipboard">
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="secondary" size="sm" onClick={save} disabled={!scene || !!busy} loading={busy === "save"} title="Save this mockup to the project assets">
              <ImagePlus className="h-4 w-4" /> Save to assets
            </Button>
            <Button size="sm" onClick={download} disabled={!scene || !!busy} loading={busy === "download"} title="Download PNG at 2×">
              <Download className="h-4 w-4" /> Download PNG
            </Button>
          </div>
        </div>
        <div className="relative bg-bg-inset flex items-center justify-center p-3">
          <canvas
            ref={canvasRef}
            width={template.size.width * 2}
            height={template.size.height * 2}
            className="block max-w-full h-auto max-h-[64vh] rounded-md shadow-card"
            aria-label={`${template.name} mockup preview`}
          />
          {!scene && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-fg-muted bg-bg-inset/60">
              <Spinner /> Preparing logos and fonts…
            </div>
          )}
        </div>
      </div>

      <div className="surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="label">Controls</div>
          <Button variant="ghost" size="sm" onClick={() => onOptions(DEFAULT_OPTIONS)} disabled={isDefault} title="Reset all controls">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
          <Field label="Logo artwork" hint={scene?.logos.placeholder ? "placeholder" : undefined}>
            <Select value={options.variant} onChange={(e) => onOptions({ variant: e.target.value as LogoVariantChoice })} aria-label="Logo artwork">
              {VARIANTS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Environment">
            <Tabs
              value={options.theme}
              onChange={(theme) => onOptions({ theme })}
              items={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Field>
          <Field label="Backdrop colour" hint={options.background ? options.background : "auto"}>
            <div className="flex flex-wrap items-center gap-1.5 min-h-9">
              <button
                type="button"
                onClick={() => onOptions({ background: undefined })}
                title="Automatic (from the palette and environment)"
                aria-label="Automatic backdrop"
                aria-pressed={!options.background}
                className={cn(
                  "h-7 w-7 rounded-full border bg-[linear-gradient(135deg,var(--bg-elev-2)_50%,var(--line-strong)_50%)] cursor-pointer",
                  !options.background ? "border-accent ring-2 ring-accent/40" : "border-line-strong",
                )}
              />
              {palette.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOptions({ background: c.hex })}
                  title={`${c.name} ${c.hex}`}
                  aria-label={`Backdrop ${c.name}`}
                  aria-pressed={options.background === c.hex}
                  style={{ background: c.hex }}
                  className={cn("h-7 w-7 rounded-full border cursor-pointer", options.background === c.hex ? "border-accent ring-2 ring-accent/40" : "border-black/20")}
                />
              ))}
            </div>
          </Field>
          <Field label="Logo scale" hint={`${Math.round(options.logoScale * 100)}%`}>
            <Slider min={0.5} max={1.6} step={0.01} value={options.logoScale} onChange={(e) => onOptions({ logoScale: Number(e.target.value) })} aria-label="Logo scale" />
          </Field>
          <Field label="Logo offset X" hint={`${Math.round(options.logoOffset.x * 100)}%`}>
            <Slider min={-0.4} max={0.4} step={0.01} value={options.logoOffset.x} onChange={(e) => onOptions({ logoOffset: { ...options.logoOffset, x: Number(e.target.value) } })} aria-label="Logo offset X" />
          </Field>
          <Field label="Logo offset Y" hint={`${Math.round(options.logoOffset.y * 100)}%`}>
            <Slider min={-0.4} max={0.4} step={0.01} value={options.logoOffset.y} onChange={(e) => onOptions({ logoOffset: { ...options.logoOffset, y: Number(e.target.value) } })} aria-label="Logo offset Y" />
          </Field>
          <Field label="Grain" hint={`${Math.round(options.grain * 100)}%`}>
            <Slider min={0} max={1} step={0.01} value={options.grain} onChange={(e) => onOptions({ grain: Number(e.target.value) })} aria-label="Grain intensity" />
          </Field>
          <div className="flex items-end pb-1">
            <Switch checked={options.showTagline} onChange={(showTagline) => onOptions({ showTagline })} label="Show tagline" />
          </div>
          <div className="flex items-end pb-1">
            <Switch checked={options.invert} onChange={(invert) => onOptions({ invert })} label="Invert one-colour logos" />
          </div>
        </div>
      </div>
    </div>
  );
}

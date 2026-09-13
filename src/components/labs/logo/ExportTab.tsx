"use client";
import * as React from "react";
import { toast } from "sonner";
import { Download, FileImage, Package } from "lucide-react";
import { Badge, Button, Card, Select, Switch } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { LogoVariantKey } from "@/lib/genome/schema";
import { getLogoVariants, paletteColor, placeholderMarkSvg, placeholderWordmarkSvg } from "@/lib/logo/assets";
import { composeLockup, monochrome, tileSvg } from "@/lib/logo/svg";
import { VARIANT_LABELS, VARIANT_ORDER, buildLogoKit, kitFilename, type KitVariant } from "@/lib/logo/export";
import { svgSize, svgToPngBlob } from "@/lib/raster";
import { downloadBlob, formatBytes, slugify } from "@/lib/utils";
import { Control, Notice, SvgView, downloadSvg, errorMessage } from "./shared";

const BASE_WIDTHS = [256, 512, 1024, 2048];
const SCALES = [1, 2, 4];

export function ExportTab({ onGoLockups }: { onGoLockups: () => void }) {
  const genome = useProject((s) => s.genome)!;
  const assets = useProject((s) => s.assets);

  const saved = React.useMemo(() => getLogoVariants(genome, assets), [genome, assets]);
  const savedKeys = VARIANT_ORDER.filter((k) => saved[k]);
  const usingPreview = savedKeys.length === 0;

  // When nothing is saved yet, offer a preview kit built from placeholders so the pipeline is still usable.
  const variants = React.useMemo<KitVariant[]>(() => {
    if (!usingPreview) return savedKeys.map((k) => ({ key: k, svg: saved[k]!.svg, label: VARIANT_LABELS[k] }));
    const mark = placeholderMarkSvg(genome);
    const wordmark = placeholderWordmarkSvg(genome);
    const primaryHex = paletteColor(genome, "primary", "#1f1f1f");
    const ink = paletteColor(genome, "text", "#111111");
    const horizontal = composeLockup({ mark, wordmark, layout: "horizontal" });
    const stacked = composeLockup({ mark, wordmark, layout: "stacked" });
    return [
      { key: "primary", svg: horizontal },
      { key: "horizontal", svg: horizontal },
      { key: "stacked", svg: stacked },
      { key: "mark", svg: mark },
      { key: "wordmark", svg: wordmark },
      { key: "mono-dark", svg: monochrome(horizontal, ink) },
      { key: "mono-light", svg: monochrome(horizontal, "#ffffff") },
      { key: "favicon", svg: tileSvg(mark, { background: primaryHex }) },
    ].map((v) => ({ ...v, label: VARIANT_LABELS[v.key as LogoVariantKey] }));
  }, [genome, saved, savedKeys, usingPreview]);

  const [excluded, setExcluded] = React.useState<Record<string, boolean>>({});
  const [baseWidth, setBaseWidth] = React.useState(512);
  const [scales, setScales] = React.useState<number[]>(SCALES);
  const [includePng, setIncludePng] = React.useState(true);
  const [includeFavicon, setIncludeFavicon] = React.useState(true);
  const [building, setBuilding] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);

  const selected = variants.filter((v) => !excluded[v.key]);
  const darkBg = paletteColor(genome, "secondary", "#111111");
  const lightBg = paletteColor(genome, "background", "#ffffff");

  const downloadKit = async () => {
    if (!selected.length) {
      toast.error("Select at least one variant");
      return;
    }
    setBuilding(true);
    try {
      const blob = await buildLogoKit(genome, selected, {
        baseWidth,
        scales: scales.length ? scales : [1],
        includePng,
        includeFavicon,
        monoLightBackground: darkBg,
        onProgress: (msg) => setProgress(msg),
      });
      downloadBlob(blob, kitFilename(genome));
      toast.success(`Logo kit downloaded (${formatBytes(blob.size)})`);
    } catch (e) {
      toast.error(`Kit failed: ${errorMessage(e)}`);
    } finally {
      setBuilding(false);
      setProgress(null);
    }
  };

  const downloadPng = async (v: KitVariant) => {
    try {
      const bg = v.key === "mono-light" ? darkBg : undefined;
      const blob = await svgToPngBlob(v.svg, baseWidth, undefined, bg ? { background: bg, padding: Math.round(baseWidth * 0.06) } : {});
      downloadBlob(blob, `${slugify(genome.name)}-${v.key}@${baseWidth}.png`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const fileCount = selected.length * (1 + (includePng ? scales.length : 0)) + (includeFavicon ? 5 : 0) + 1;

  return (
    <div className="flex flex-col gap-4">
      {usingPreview ? (
        <Notice tone="warning" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>No variants saved yet — the kit below uses generated placeholders so you can test the pipeline.</span>
          <Button variant="link" size="sm" onClick={onGoLockups}>
            Save real variants in Lockups →
          </Button>
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
        <Card className="flex flex-col gap-4">
          <Control label="PNG base width" hint="@1x">
            <Select value={baseWidth} onChange={(e) => setBaseWidth(Number(e.target.value))} aria-label="PNG base width">
              {BASE_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w}px
                </option>
              ))}
            </Select>
          </Control>
          <Control label="Scales">
            <div className="flex gap-1.5">
              {SCALES.map((s) => {
                const on = scales.includes(s);
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => setScales((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s].sort((a, b) => a - b)))} className={`flex-1 flex flex-col items-center rounded-md border py-1.5 leading-tight cursor-pointer ${on ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-muted hover:border-line-strong"}`}>
                    <span className="text-[12px] font-medium">@{s}x</span>
                    <span className="text-[10px] font-mono opacity-70">{baseWidth * s}px</span>
                  </button>
                );
              })}
            </div>
          </Control>
          <Switch checked={includePng} onChange={setIncludePng} label="Include PNGs" className="text-left" />
          <Switch checked={includeFavicon} onChange={setIncludeFavicon} label="Include favicon set (.ico, touch icon, PWA icons)" className="text-left" />
          <div className="h-px bg-line" />
          <Button onClick={downloadKit} loading={building} className="w-full" data-testid="download-kit">
            <Package className="h-4 w-4" /> Download logo kit (.zip)
          </Button>
          <p className="text-[11px] text-fg-subtle -mt-2">{progress ? `Packing ${progress}…` : `${selected.length} variant${selected.length === 1 ? "" : "s"} · ~${fileCount} files · README with usage rules, clearspace and min size.`}</p>
        </Card>

        <div className="surface overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-baseline justify-between">
            <div className="text-sm font-semibold">Variants</div>
            <span className="text-[11px] text-fg-subtle">Untick to leave a variant out of the kit</span>
          </div>
          <ul className="divide-y divide-line">
            {variants.map((v) => {
              const on = !excluded[v.key];
              const size = svgSize(v.svg);
              const dark = v.key === "mono-light";
              return (
                <li key={v.key} className="flex items-center gap-3 px-4 py-2.5">
                  <input type="checkbox" checked={on} onChange={(e) => setExcluded((cur) => ({ ...cur, [v.key]: !e.target.checked }))} aria-label={`Include ${v.label}`} className="accent-[var(--accent)] h-4 w-4 shrink-0 cursor-pointer" />
                  <div className="h-11 w-16 shrink-0 rounded-md border border-line p-1.5" style={{ background: dark ? darkBg : lightBg }}>
                    <SvgView svg={v.svg} className="h-full w-full" title={v.label} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-medium truncate">{v.label ?? v.key}</span>
                      {saved[v.key as LogoVariantKey]?.source === "variant" ? <Badge tone="success">saved</Badge> : v.key === "mark" || v.key === "wordmark" ? <Badge tone="neutral">{saved[v.key as LogoVariantKey] ? "chosen" : "placeholder"}</Badge> : usingPreview ? <Badge tone="warning">placeholder</Badge> : null}
                    </div>
                    <div className="text-[11px] text-fg-subtle font-mono truncate">
                      {v.key}.svg · {Math.round(size.width)}×{Math.round(size.height)}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => downloadSvg(v.svg, `${genome.name}-${v.key}`)} title="Download SVG" className="px-2">
                      <Download className="h-3.5 w-3.5" /> SVG
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => downloadPng(v)} title={`Download PNG at ${baseWidth}px`} className="px-2">
                      <FileImage className="h-3.5 w-3.5" /> PNG
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

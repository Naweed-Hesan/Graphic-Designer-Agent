"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, Eraser, PenTool, RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, Card, EmptyState, Progress, Select, Slider, Switch, Tabs } from "@/components/ui";
import { useProject, assetUrl } from "@/lib/store/project";
import { paletteColor } from "@/lib/logo/assets";
import { svgSize } from "@/lib/raster";
import { nearestColor, recolorSvg, svgStats } from "@/lib/logo/svg";
import { DEFAULT_VECTORIZE, TRACE_PRESETS, removeImageBackground, vectorizeImage, type TracePreset, type VectorizeResult } from "@/lib/logo/vectorize";
import { formatBytes } from "@/lib/utils";
import { Control, DownloadSvgButton, MARK_TAG, Notice, PaletteChips, SvgView, errorMessage, useLogoConcepts } from "./shared";

type ColorMode = "original" | "nearest" | "single" | "custom";

const PRESET_DEFAULTS: Record<TracePreset, Partial<typeof DEFAULT_VECTORIZE>> = {
  default: { numberofcolors: 16, blurradius: 0, ltres: 1, qtres: 1, pathomit: 8 },
  posterized1: { numberofcolors: 2, blurradius: 0 },
  posterized2: { numberofcolors: 4, blurradius: 5 },
  posterized3: { numberofcolors: 3, blurradius: 3, pathomit: 20 },
  curvy: { ltres: 0.01 },
  sharp: { qtres: 0.01 },
  detailed: { pathomit: 0, ltres: 0.5, qtres: 0.5, numberofcolors: 64 },
  smoothed: { blurradius: 5 },
  grayscale: { numberofcolors: 7 },
  artistic2: { numberofcolors: 4, qtres: 0.01 },
};

export function VectoriseTab({ sourceId, onSourceChange, onGoConcepts, onSaved }: { sourceId: string | null; onSourceChange: (id: string) => void; onGoConcepts: () => void; onSaved: () => void }) {
  const genome = useProject((s) => s.genome)!;
  const update = useProject((s) => s.update);
  const addAsset = useProject((s) => s.addAsset);
  const concepts = useLogoConcepts();
  const asset = concepts.find((a) => a.id === sourceId) ?? concepts[0];

  const [preset, setPreset] = React.useState<TracePreset>(DEFAULT_VECTORIZE.preset);
  const [colors, setColors] = React.useState(DEFAULT_VECTORIZE.numberofcolors);
  const [pathomit, setPathomit] = React.useState(DEFAULT_VECTORIZE.pathomit);
  const [ltres, setLtres] = React.useState(DEFAULT_VECTORIZE.ltres);
  const [qtres, setQtres] = React.useState(DEFAULT_VECTORIZE.qtres);
  const [blur, setBlur] = React.useState(DEFAULT_VECTORIZE.blurradius);
  const [dropWhite, setDropWhite] = React.useState(true);
  const [removeBg, setRemoveBg] = React.useState(false);
  const [bgResult, setBgResult] = React.useState<{ id: string; blob: Blob; url: string } | null>(null);
  const [bgProgress, setBgProgress] = React.useState<number | null>(null);
  const [traced, setTraced] = React.useState<{ id: string; result: VectorizeResult } | null>(null);
  const [tracing, setTracing] = React.useState(false);
  const [colorMode, setColorMode] = React.useState<ColorMode>("original");
  const primaryHex = paletteColor(genome, "primary", "#1f1f1f");
  const [singleColor, setSingleColor] = React.useState(primaryHex);
  const [customMap, setCustomMap] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const usingBgRemoved = !!asset && removeBg && bgResult?.id === asset.id;

  // Trace whenever the source or a control changes (debounced; async results are ignored once stale).
  React.useEffect(() => {
    if (!asset) return;
    const blob = removeBg && bgResult?.id === asset.id ? bgResult.blob : asset.blob;
    let cancelled = false;
    const id = asset.id;
    const t = setTimeout(() => {
      setTracing(true);
      vectorizeImage(blob, { preset, numberofcolors: colors, pathomit, ltres, qtres, blurradius: blur, removeBackground: dropWhite })
        .then((result) => {
          if (!cancelled) setTraced({ id, result });
        })
        .catch((e) => {
          if (!cancelled) toast.error(`Trace failed: ${errorMessage(e)}`);
        })
        .finally(() => {
          if (!cancelled) setTracing(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [asset, removeBg, bgResult, preset, colors, pathomit, ltres, qtres, blur, dropWhite]);

  const result = traced && asset && traced.id === asset.id ? traced.result : null;
  const brandHexes = React.useMemo(() => genome.visual.palette.colors.map((c) => c.hex), [genome.visual.palette.colors]);

  const finalSvg = React.useMemo(() => {
    if (!result) return null;
    switch (colorMode) {
      case "single":
        return recolorSvg(result.svg, singleColor);
      case "nearest":
        return recolorSvg(result.svg, Object.fromEntries(result.colors.map((c) => [c, nearestColor(c, brandHexes)])));
      case "custom":
        return recolorSvg(result.svg, customMap);
      default:
        return result.svg;
    }
  }, [result, colorMode, singleColor, brandHexes, customMap]);

  const stats = React.useMemo(() => (finalSvg ? svgStats(finalSvg) : null), [finalSvg]);

  const applyPreset = (p: TracePreset) => {
    setPreset(p);
    const d = { ...DEFAULT_VECTORIZE, ...PRESET_DEFAULTS[p] };
    setColors(d.numberofcolors);
    setPathomit(d.pathomit);
    setLtres(d.ltres);
    setQtres(d.qtres);
    setBlur(d.blurradius);
  };

  const resetControls = () => applyPreset(DEFAULT_VECTORIZE.preset);

  const changeSource = (id: string) => {
    onSourceChange(id);
    setRemoveBg(false);
    setColorMode("original");
    setCustomMap({});
  };

  const toggleRemoveBg = async (on: boolean) => {
    if (!asset) return;
    if (!on) {
      setRemoveBg(false);
      return;
    }
    if (bgResult?.id === asset.id) {
      setRemoveBg(true);
      return;
    }
    setBgProgress(0);
    try {
      const blob = await removeImageBackground(asset.blob, (f) => setBgProgress(f));
      if (bgResult) URL.revokeObjectURL(bgResult.url);
      setBgResult({ id: asset.id, blob, url: URL.createObjectURL(blob) });
      setRemoveBg(true);
      toast.success("Background removed");
    } catch (e) {
      toast.error(`Background removal unavailable (${errorMessage(e).slice(0, 120)}). Tracing the original instead — the "drop white background" cleanup still applies.`, { duration: 7000 });
      setRemoveBg(false);
    } finally {
      setBgProgress(null);
    }
  };

  const useAsMark = async () => {
    if (!finalSvg || !asset) return;
    setSaving(true);
    try {
      const size = svgSize(finalSvg);
      const saved = await addAsset({
        kind: "svg",
        name: `Mark — ${asset.name}`,
        mime: "image/svg+xml",
        blob: new Blob([finalSvg], { type: "image/svg+xml" }),
        svg: finalSvg,
        width: size.width,
        height: size.height,
        parentId: asset.id,
        stage: "logo",
        tags: [MARK_TAG, "vectorised"],
      });
      update(
        (g) => {
          g.visual.logo.markAssetId = saved.id;
          g.visual.logo.variants.mark = saved.id;
          if (!g.stages.logo || g.stages.logo === "todo") g.stages.logo = "in-progress";
        },
        { summary: `Set logo mark from ${asset.name}`, stage: "logo" },
      );
      toast.success("Mark saved — build the wordmark and lockups next");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!concepts.length) {
    return (
      <EmptyState
        icon={<PenTool className="h-8 w-8" />}
        title="Nothing to vectorise yet"
        description="Generate or upload a concept image first. Raster concepts are traced into clean SVG paths here, then recoloured with the brand palette."
        action={
          <Button variant="secondary" size="sm" onClick={onGoConcepts}>
            <Sparkles className="h-4 w-4" /> Go to Concepts
          </Button>
        }
        className="min-h-[360px]"
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr] items-start">
      <Card className="flex flex-col gap-4">
        <Control label="Source">
          <Select value={asset?.id ?? ""} onChange={(e) => changeSource(e.target.value)} aria-label="Source concept">
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {asset ? (
            <div className="checker rounded-md overflow-hidden h-24 mt-1 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={usingBgRemoved && bgResult ? bgResult.url : assetUrl(asset)} alt={asset.name} className="h-full object-contain" />
            </div>
          ) : null}
        </Control>

        <div className="flex flex-col gap-2">
          <Switch checked={removeBg} onChange={(v) => void toggleRemoveBg(v)} label="Remove background first (ML)" className="text-left" />
          {bgProgress !== null ? (
            <div className="flex flex-col gap-1">
              <Progress value={bgProgress * 100} />
              <span className="text-[11px] text-fg-subtle">Downloading model & segmenting… {Math.round(bgProgress * 100)}%</span>
            </div>
          ) : (
            <span className="text-[11px] text-fg-subtle">Uses @imgly/background-removal (downloads ~40 MB once). Needs internet.</span>
          )}
          <Switch checked={dropWhite} onChange={setDropWhite} label="Drop white background layers" className="text-left" />
        </div>

        <div className="h-px bg-line" />

        <Control label="Preset" hint={TRACE_PRESETS.find((p) => p.id === preset)?.hint}>
          <Select value={preset} onChange={(e) => applyPreset(e.target.value as TracePreset)} aria-label="Trace preset">
            {TRACE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Control>
        <Control label="Colours" hint={String(colors)}>
          <Slider min={2} max={32} step={1} value={colors} onChange={(e) => setColors(Number(e.target.value))} aria-label="Number of colours" />
        </Control>
        <Control label="Path omit" hint={`${pathomit} px`}>
          <Slider min={0} max={64} step={1} value={pathomit} onChange={(e) => setPathomit(Number(e.target.value))} aria-label="Minimum path size" />
        </Control>
        <Control label="Line threshold" hint={ltres.toFixed(2)}>
          <Slider min={0.01} max={4} step={0.01} value={ltres} onChange={(e) => setLtres(Number(e.target.value))} aria-label="Line fitting threshold" />
        </Control>
        <Control label="Curve threshold" hint={qtres.toFixed(2)}>
          <Slider min={0.01} max={4} step={0.01} value={qtres} onChange={(e) => setQtres(Number(e.target.value))} aria-label="Curve fitting threshold" />
        </Control>
        <Control label="Blur radius" hint={String(blur)}>
          <Slider min={0} max={10} step={1} value={blur} onChange={(e) => setBlur(Number(e.target.value))} aria-label="Blur radius" />
        </Control>
        <Button variant="ghost" size="sm" onClick={resetControls} className="self-start -ml-2">
          <RotateCcw className="h-3.5 w-3.5" /> Reset controls
        </Button>
      </Card>

      <div className="flex flex-col gap-4 min-w-0">
        <div className="surface overflow-hidden">
          <div className="checker relative h-[340px] p-8">
            {finalSvg ? <SvgView svg={finalSvg} className="h-full w-full" title="Traced result" /> : <div className="h-full flex items-center justify-center text-sm text-fg-muted">{tracing ? "Tracing…" : "Waiting for a source"}</div>}
            {tracing && finalSvg ? (
              <div className="absolute top-3 right-3">
                <Badge tone="accent">Retracing…</Badge>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-line text-[12px] text-fg-muted">
            {stats && result ? (
              <>
                <span>{stats.paths} paths</span>
                <span>{stats.colors} colours</span>
                <span>{formatBytes(stats.bytes)}</span>
                <span>
                  {Math.round(result.width)}×{Math.round(result.height)} units
                </span>
              </>
            ) : (
              <span>—</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {finalSvg && asset ? <DownloadSvgButton svg={finalSvg} name={`${asset.name}-traced`} /> : null}
              <Button size="sm" onClick={useAsMark} disabled={!finalSvg} loading={saving}>
                <Check className="h-4 w-4" /> Use as mark
              </Button>
            </div>
          </div>
        </div>

        {/* Sizes */}
        {finalSvg ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { bg: "#ffffff", label: "On white" },
              { bg: "#111111", label: "On black" },
            ].map((b) => (
              <div key={b.bg} className="surface-2 overflow-hidden">
                <div className="flex flex-wrap items-end justify-center gap-x-5 gap-y-3 px-4 py-5" style={{ background: b.bg }}>
                  {[96, 48, 24, 16].map((px) => (
                    <div key={px} className="flex flex-col items-center gap-1.5">
                      <SvgView svg={finalSvg} style={{ width: px, height: px }} title={`${px}px`} />
                      <span className="text-[10px] font-mono" style={{ color: b.bg === "#ffffff" ? "#777" : "#999" }}>
                        {px}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-1.5 text-[11px] text-fg-muted border-t border-line">{b.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Recolour */}
        {result ? (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Palette recolour</div>
                <p className="text-[12px] text-fg-muted">Snap the traced colours to the brand palette, or flatten to one colour for a mark that reproduces anywhere.</p>
              </div>
              <Tabs
                value={colorMode}
                onChange={setColorMode}
                items={[
                  { value: "original", label: "Traced" },
                  { value: "nearest", label: "Nearest brand" },
                  { value: "single", label: "Single colour" },
                  { value: "custom", label: "Map each" },
                ]}
              />
            </div>
            {colorMode === "single" ? <PaletteChips genome={genome} value={singleColor} onChange={setSingleColor} /> : null}
            {colorMode === "nearest" ? (
              <div className="flex flex-wrap gap-2">
                {result.colors.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 text-[11px] font-mono text-fg-muted">
                    <span className="h-4 w-4 rounded-sm border border-line" style={{ background: c }} />→
                    <span className="h-4 w-4 rounded-sm border border-line" style={{ background: nearestColor(c, brandHexes) }} />
                  </span>
                ))}
                {!brandHexes.length ? <Notice tone="warning">No palette yet — add colours in the Color lab to snap to them.</Notice> : null}
              </div>
            ) : null}
            {colorMode === "custom" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {result.colors.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-[12px]">
                    <span className="h-6 w-6 shrink-0 rounded-md border border-line" style={{ background: c }} title={c} />
                    <span className="font-mono text-fg-muted w-16">{c.toUpperCase()}</span>
                    <Select value={customMap[c] ?? ""} onChange={(e) => setCustomMap((m) => ({ ...m, [c]: e.target.value }))} className="h-8 text-[12px]" aria-label={`Map ${c}`}>
                      <option value="">keep</option>
                      {genome.visual.palette.colors.map((b) => (
                        <option key={b.id} value={b.hex}>
                          {b.name} {b.hex.toUpperCase()}
                        </option>
                      ))}
                      <option value="#111111">Near black #111111</option>
                      <option value="#ffffff">White #FFFFFF</option>
                    </Select>
                  </label>
                ))}
              </div>
            ) : null}
            {colorMode === "original" ? (
              <div className="flex flex-wrap gap-1.5">
                {result.colors.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11px] font-mono text-fg-muted">
                    <span className="h-3 w-3 rounded-full border border-line" style={{ background: c }} /> {c.toUpperCase()}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {!removeBg && bgProgress === null ? (
          <p className="text-[12px] text-fg-subtle flex items-center gap-1.5">
            <Eraser className="h-3.5 w-3.5" /> Tip: concepts on plain white trace cleanly with &quot;drop white background&quot; on. Use ML background removal for photos or textured backgrounds.
          </p>
        ) : null}
      </div>
    </div>
  );
}

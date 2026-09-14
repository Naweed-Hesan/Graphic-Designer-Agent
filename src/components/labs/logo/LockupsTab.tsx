"use client";
import * as React from "react";
import { toast } from "sonner";
import { Layers, Save } from "lucide-react";
import { Badge, Button, Card, Select, Slider, Tabs } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { LogoVariantKey } from "@/lib/genome/schema";
import { getLogoVariants, paletteColor, placeholderMarkSvg, placeholderWordmarkSvg } from "@/lib/logo/assets";
import { composeLockup, monochrome, tileSvg } from "@/lib/logo/svg";
import { VARIANT_LABELS } from "@/lib/logo/export";
import { bestTextOn } from "@/lib/color/contrast";
import { svgSize } from "@/lib/raster";
import { Control, Notice, PreviewCard, SvgView, VARIANT_TAG, errorMessage } from "./shared";

type Layout = "horizontal" | "stacked";
type Align = "start" | "center" | "end";
type ColorMode = "full" | "mono-dark" | "mono-light" | "reversed";

export function LockupsTab({ onGoVectorise, onGoWordmark, onSaved }: { onGoVectorise: () => void; onGoWordmark: () => void; onSaved: () => void }) {
  const genome = useProject((s) => s.genome)!;
  const assets = useProject((s) => s.assets);
  const update = useProject((s) => s.update);
  const addAsset = useProject((s) => s.addAsset);
  const removeAsset = useProject((s) => s.removeAsset);

  const variants = React.useMemo(() => getLogoVariants(genome, assets), [genome, assets]);
  const markSvg = variants.mark?.svg ?? placeholderMarkSvg(genome);
  const wordmarkSvg = variants.wordmark?.svg ?? placeholderWordmarkSvg(genome);
  const markPlaceholder = !variants.mark;
  const wordmarkPlaceholder = !variants.wordmark;

  const [layout, setLayout] = React.useState<Layout>("horizontal");
  const [gap, setGap] = React.useState(0.25);
  const [align, setAlign] = React.useState<Align>("center");
  const [wmScale, setWmScale] = React.useState(0.5);
  const [colorMode, setColorMode] = React.useState<ColorMode>("full");
  const [faviconStyle, setFaviconStyle] = React.useState<"tile" | "mark">("tile");
  const [saving, setSaving] = React.useState(false);

  const primaryHex = paletteColor(genome, "primary", "#1f1f1f");
  const lightBg = paletteColor(genome, "background", "#ffffff");
  const darkBg = paletteColor(genome, "secondary", "#111111");
  const inkHex = paletteColor(genome, "text", "#111111");

  const lockup = React.useMemo(() => composeLockup({ mark: markSvg, wordmark: wordmarkSvg, layout, gap, align, wordmarkScale: wmScale }), [markSvg, wordmarkSvg, layout, gap, align, wmScale]);
  const favicon = React.useMemo(() => (faviconStyle === "tile" ? tileSvg(markSvg, { background: primaryHex }) : markSvg), [markSvg, faviconStyle, primaryHex]);

  const tint = React.useCallback(
    (svg: string) => {
      switch (colorMode) {
        case "mono-dark":
          return monochrome(svg, inkHex);
        case "mono-light":
          return monochrome(svg, "#ffffff");
        case "reversed":
          return monochrome(svg, bestTextOn(primaryHex));
        default:
          return svg;
      }
    },
    [colorMode, inkHex, primaryHex],
  );

  const shown = React.useMemo(() => tint(lockup), [tint, lockup]);

  const saveVariants = async () => {
    setSaving(true);
    try {
      const horizontal = composeLockup({ mark: markSvg, wordmark: wordmarkSvg, layout: "horizontal", gap, align, wordmarkScale: layout === "horizontal" ? wmScale : 0.5 });
      const stacked = composeLockup({ mark: markSvg, wordmark: wordmarkSvg, layout: "stacked", gap, align, wordmarkScale: layout === "stacked" ? wmScale : 0.32 });
      const primary = layout === "horizontal" ? horizontal : stacked;
      const entries: { key: LogoVariantKey; svg: string }[] = [
        { key: "primary", svg: primary },
        { key: "horizontal", svg: horizontal },
        { key: "stacked", svg: stacked },
        { key: "mark", svg: markSvg },
        { key: "wordmark", svg: wordmarkSvg },
        { key: "mono-dark", svg: monochrome(primary, inkHex) },
        { key: "mono-light", svg: monochrome(primary, "#ffffff") },
        { key: "favicon", svg: favicon },
      ];
      const ids: Partial<Record<LogoVariantKey, string>> = {};
      for (const e of entries) {
        if (e.key === "mark" && variants.mark?.assetId) {
          ids.mark = variants.mark.assetId;
          continue;
        }
        if (e.key === "wordmark" && variants.wordmark?.assetId) {
          ids.wordmark = variants.wordmark.assetId;
          continue;
        }
        if ((e.key === "mark" && markPlaceholder) || (e.key === "wordmark" && wordmarkPlaceholder)) continue;
        const size = svgSize(e.svg);
        const a = await addAsset({
          kind: "svg",
          name: `Logo — ${VARIANT_LABELS[e.key]}`,
          mime: "image/svg+xml",
          blob: new Blob([e.svg], { type: "image/svg+xml" }),
          svg: e.svg,
          width: size.width,
          height: size.height,
          stage: "logo",
          tags: [VARIANT_TAG, e.key, ...(markPlaceholder || wordmarkPlaceholder ? ["placeholder"] : [])],
        });
        ids[e.key] = a.id;
      }
      // Retire the previous generation of composed variants (never the chosen mark/wordmark assets).
      const previous = genome.visual.logo.variants;
      const keep = new Set([genome.visual.logo.markAssetId, genome.visual.logo.wordmarkAssetId, ...Object.values(ids)]);
      for (const oldId of Object.values(previous)) {
        if (keep.has(oldId)) continue;
        const old = assets.find((a) => a.id === oldId);
        if (old?.tags.includes(VARIANT_TAG)) await removeAsset(oldId);
      }
      update(
        (g) => {
          g.visual.logo.variants = { ...g.visual.logo.variants, ...ids };
          if (!g.stages.logo || g.stages.logo === "todo") g.stages.logo = "in-progress";
        },
        { summary: "Saved logo lockup variants", stage: "logo" },
      );
      toast.success(`${entries.length} variants saved${markPlaceholder || wordmarkPlaceholder ? " (with placeholders — re-save after setting the real mark/wordmark)" : ""}`);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {markPlaceholder || wordmarkPlaceholder ? (
        <Notice tone="warning" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {markPlaceholder && wordmarkPlaceholder ? "No mark or wordmark yet — showing generated placeholders so you can set up the lockup." : markPlaceholder ? "No mark yet — using a generated placeholder mark." : "No wordmark yet — using a generated placeholder wordmark."}
          </span>
          {markPlaceholder ? (
            <Button variant="link" size="sm" onClick={onGoVectorise}>
              Vectorise a concept →
            </Button>
          ) : null}
          {wordmarkPlaceholder ? (
            <Button variant="link" size="sm" onClick={onGoWordmark}>
              Build the wordmark →
            </Button>
          ) : null}
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
        <Card className="flex flex-col gap-4">
          <Control label="Layout">
            <Tabs
              value={layout}
              onChange={(v) => {
                setLayout(v);
                setWmScale(v === "horizontal" ? 0.5 : 0.32);
              }}
              items={[
                { value: "horizontal", label: "Horizontal" },
                { value: "stacked", label: "Stacked" },
              ]}
              className="w-full [&>button]:flex-1"
            />
          </Control>
          <Control label="Gap" hint={`${Math.round(gap * 100)}% of mark`}>
            <Slider min={0} max={1} step={0.01} value={gap} onChange={(e) => setGap(Number(e.target.value))} aria-label="Gap" />
          </Control>
          <Control label="Wordmark size" hint={`${Math.round(wmScale * 100)}% of mark`}>
            <Slider min={0.15} max={1.2} step={0.01} value={wmScale} onChange={(e) => setWmScale(Number(e.target.value))} aria-label="Wordmark size" />
          </Control>
          <Control label={layout === "horizontal" ? "Vertical alignment" : "Horizontal alignment"}>
            <Select value={align} onChange={(e) => setAlign(e.target.value as Align)} aria-label="Alignment">
              <option value="start">{layout === "horizontal" ? "Top" : "Left"}</option>
              <option value="center">Centre</option>
              <option value="end">{layout === "horizontal" ? "Bottom" : "Right"}</option>
            </Select>
          </Control>
          <Control label="Colour mode">
            <Select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} aria-label="Colour mode">
              <option value="full">Full colour</option>
              <option value="mono-dark">Mono dark</option>
              <option value="mono-light">Mono light</option>
              <option value="reversed">Reversed on primary</option>
            </Select>
          </Control>
          <Control label="Favicon">
            <Select value={faviconStyle} onChange={(e) => setFaviconStyle(e.target.value as "tile" | "mark")} aria-label="Favicon style">
              <option value="tile">Mark on primary tile</option>
              <option value="mark">Mark alone</option>
            </Select>
          </Control>
          <div className="h-px bg-line" />
          <Button onClick={saveVariants} loading={saving} className="w-full">
            <Save className="h-4 w-4" /> Save variants
          </Button>
          <p className="text-[11px] text-fg-subtle -mt-2">Writes primary, horizontal, stacked, mark, wordmark, mono dark, mono light and favicon as SVG assets and fills the Genome&apos;s variant map.</p>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <PreviewCard svg={shown} background={lightBg} label={`On light · ${lightBg.toUpperCase()}`} height="h-44" />
            <PreviewCard svg={shown} background={darkBg} label={`On dark · ${darkBg.toUpperCase()}`} height="h-44" />
            <PreviewCard svg={shown} background={primaryHex} label={`On primary · ${primaryHex.toUpperCase()}`} height="h-44" />
          </div>
          <div className="surface overflow-hidden">
            <div className="p-10 h-[300px]" style={{ background: colorMode === "mono-light" ? darkBg : colorMode === "reversed" ? primaryHex : lightBg }}>
              <SvgView svg={shown} className="h-full w-full" title="Lockup preview" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-line text-[12px] text-fg-muted">
              <Layers className="h-3.5 w-3.5" /> {layout === "horizontal" ? "Horizontal" : "Stacked"} lockup · {colorMode === "full" ? "full colour" : colorMode.replace("-", " ")}
              <span className="ml-auto flex gap-1.5">
                {markPlaceholder ? <Badge tone="warning">placeholder mark</Badge> : <Badge tone="success">mark</Badge>}
                {wordmarkPlaceholder ? <Badge tone="warning">placeholder wordmark</Badge> : <Badge tone="success">wordmark</Badge>}
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PreviewCard svg={tint(markSvg)} background={colorMode === "mono-light" ? darkBg : colorMode === "reversed" ? primaryHex : lightBg} label="Mark" height="h-36" />
            <PreviewCard svg={tint(wordmarkSvg)} background={colorMode === "mono-light" ? darkBg : colorMode === "reversed" ? primaryHex : lightBg} label="Wordmark" height="h-36" />
            <PreviewCard svg={favicon} background={lightBg} label="Favicon / app icon" height="h-36" />
          </div>
        </div>
      </div>
    </div>
  );
}

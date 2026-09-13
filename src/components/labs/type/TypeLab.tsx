"use client";
import * as React from "react";
import { Code2, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, PageHeader } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import type { FontSpec } from "@/lib/genome/schema";
import type { FontMeta } from "@/app/api/fonts/route";
import { ensureFont } from "@/lib/type/fonts";
import { fallbackFor, findFont, pickWeights, toCategory, toFontSpec } from "@/lib/type/fontmeta";
import { CURATED_PAIRS } from "@/lib/type/pairing";
import { useFontList, useFontsReachable, useGenomeEditor } from "./hooks";
import { PairingHero } from "./PairingHero";
import { FontBrowser } from "./FontBrowser";
import { PairingSuggestions, type SuggestMode } from "./PairingSuggestions";
import { ScaleEditor } from "./ScaleEditor";
import { TextStylesTable } from "./TextStylesTable";
import { Specimen } from "./Specimen";
import { ExportCssDialog } from "./ExportCssDialog";
import { SLOT_LABEL, type Slot } from "./shared";

const def = STAGE_BY_ID.type;

/** Build a FontSpec for a family, preferring catalogue metadata and falling back to the curated pair's category. */
function specFor(family: string, slot: Slot, fonts: FontMeta[], previous: FontSpec): FontSpec {
  const meta = findFont(fonts, family);
  if (meta) return toFontSpec(meta, slot);
  const curated = CURATED_PAIRS.find((p) => p.display === family || p.body === family);
  const category = toCategory(curated ? (curated.display === family ? curated.displayCategory : curated.bodyCategory) : previous.category);
  return { family, source: "google", category, weights: pickWeights(undefined, slot), fallback: fallbackFor(category), variable: false };
}

export function TypeLab() {
  const genome = useProject((s) => s.genome);
  const edit = useGenomeEditor();
  const { fonts, loading: fontsLoading, source } = useFontList();
  const families = genome ? [genome.visual.typography.display, genome.visual.typography.body, genome.visual.typography.mono].filter((f) => f.source === "google").map((f) => f.family) : [];
  const reach = useFontsReachable(families);

  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [browserSlot, setBrowserSlot] = React.useState<Slot>("display");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [suggestMode, setSuggestMode] = React.useState<SuggestMode>("brand");

  if (!genome) return null;
  const t = genome.visual.typography;
  const brand = genome.brief.clientName || genome.name;

  const openBrowser = (slot: Slot) => {
    setBrowserSlot(slot);
    setBrowserOpen(true);
  };

  const assign = (slot: Slot, meta: FontMeta) => {
    const spec = toFontSpec(meta, slot);
    ensureFont(spec.family, spec.weights);
    edit((g) => void (g.visual.typography[slot] = spec), `${SLOT_LABEL[slot]} font → ${spec.family}`);
    toast.success(`${SLOT_LABEL[slot]} set to ${spec.family}`);
    setBrowserOpen(false);
  };

  const swap = () => {
    edit((g) => {
      const ty = g.visual.typography;
      [ty.display, ty.body] = [ty.body, ty.display];
    }, "Swapped display and body fonts");
  };

  const usePair = (display: string, body: string) => {
    const d = specFor(display, "display", fonts, t.display);
    const b = specFor(body, "body", fonts, t.body);
    ensureFont(d.family, d.weights);
    ensureFont(b.family, b.weights);
    edit((g) => {
      g.visual.typography.display = d;
      g.visual.typography.body = b;
    }, `Paired ${display} + ${body}`);
    toast.success(`Paired ${display} with ${body}`);
  };

  const showSuggestions = () => {
    setSuggestionsOpen(true);
    requestAnimationFrame(() => document.getElementById("type-pairings")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={`Stage ${def.short}`}
        title={def.label}
        description={def.description}
        actions={
          <>
            <Button variant="secondary" onClick={showSuggestions}>
              <Sparkles className="h-4 w-4" /> Suggest pairings
            </Button>
            <Button variant="secondary" onClick={() => setExportOpen(true)}>
              <Code2 className="h-4 w-4" /> Export CSS
            </Button>
          </>
        }
      />

      {reach === "offline" && (
        <div className="inset px-3 py-2 flex items-center gap-2 text-xs text-fg-muted -mt-2" role="status">
          <Info className="h-3.5 w-3.5 shrink-0 text-info" />
          Font previews use fallbacks until Google Fonts is reachable.
        </div>
      )}

      <PairingHero typography={t} fonts={fonts} onChange={openBrowser} onSwap={swap} onRationale={(v) => edit((g) => void (g.visual.typography.rationale = v), "Edited typography rationale")} />

      {suggestionsOpen && <PairingSuggestions genome={genome} fonts={fonts} mode={suggestMode} onMode={setSuggestMode} onUsePair={usePair} />}

      <ScaleEditor typography={t} brand={brand} edit={edit} />

      <TextStylesTable genome={genome} brand={brand} edit={edit} />

      <Specimen genome={genome} fonts={fonts} />

      {/* Mounted per open so search and filters start fresh each time. */}
      {browserOpen && <FontBrowser open onClose={() => setBrowserOpen(false)} fonts={fonts} loading={fontsLoading} source={source} slot={browserSlot} onSlotChange={setBrowserSlot} typography={t} onAssign={assign} />}
      <ExportCssDialog open={exportOpen} onClose={() => setExportOpen(false)} genome={genome} />
    </div>
  );
}

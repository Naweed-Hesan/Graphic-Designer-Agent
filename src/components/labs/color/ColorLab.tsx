"use client";
import * as React from "react";
import { Contrast, Download, ImagePlus, Layers, Moon, Palette as PaletteIcon, Sparkles } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import { ARCHETYPES } from "@/lib/genome/archetypes";
import type { DeficiencyType } from "@/lib/color/blindness";
import { archetypeSeed } from "@/lib/color/harmonies";
import { PaletteBoard } from "./PaletteBoard";
import { ContrastMatrix } from "./ContrastMatrix";
import { RampsPanel } from "./RampsPanel";
import { DarkModePanel } from "./DarkModePanel";
import { AnalysisCard } from "./AnalysisCard";
import { GenerateDialog } from "./GenerateDialog";
import { ExtractDialog } from "./ExtractDialog";
import { ExportDialog } from "./ExportDialog";

type DialogId = "generate" | "extract" | "export" | null;
type Panel = "contrast" | "ramps" | "dark";

export function ColorLab() {
  const genome = useProject((s) => s.genome);
  const [dialog, setDialog] = React.useState<DialogId>(null);
  const [sim, setSim] = React.useState<DeficiencyType | null>(null);
  const [panel, setPanel] = React.useState<Panel>("contrast");
  const closeDialog = React.useCallback(() => setDialog(null), []);
  if (!genome) return null;

  const def = STAGE_BY_ID.color;
  const palette = genome.visual.palette;
  const colors = palette.colors;
  const seed = archetypeSeed(genome.strategy.archetype);
  const archetypeName = ARCHETYPES.find((a) => a.id === genome.strategy.archetype)?.name.replace(/^The /, "");

  return (
    <div>
      <PageHeader
        eyebrow={`Stage ${def.short}`}
        title={def.label}
        description={def.description}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDialog("extract")}>
              <ImagePlus className="h-4 w-4" /> Extract from image
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog("export")} disabled={!colors.length} title={colors.length ? "CSS, SCSS, Tailwind, DTCG, Tokens Studio, ASE" : "Add colours first"}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setDialog("generate")}>
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
          </>
        }
      />

      {colors.length === 0 ? (
        <EmptyState
          className="py-16"
          icon={<PaletteIcon className="h-8 w-8" />}
          title="No palette yet"
          description={
            archetypeName
              ? `${archetypeName} brands lean toward ${seed.note}. Start there, or seed with any colour and let the personality axes shape the rest.`
              : `Start from a seed colour — ${seed.note} — or pull colours out of a reference image.`
          }
          action={
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => setDialog("generate")}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-elev px-2 py-1.5 text-sm hover:border-line-strong cursor-pointer"
                title="Suggested seed"
              >
                <span className="h-6 w-6 rounded border border-black/10" style={{ background: seed.hex }} />
                <span className="font-mono text-[12px] uppercase">{seed.hex}</span>
                <span className="text-fg-muted text-[12px]">suggested seed</span>
              </button>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog("generate")}>
                  <Sparkles className="h-4 w-4" /> Generate palette
                </Button>
                <Button variant="secondary" onClick={() => setDialog("extract")}>
                  <ImagePlus className="h-4 w-4" /> Extract from image
                </Button>
              </div>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-5 @container">
          <PaletteBoard colors={colors} sim={sim} onSimChange={setSim} />
          <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_340px] items-start">
            <Card className="min-w-0">
              <Tabs<Panel>
                value={panel}
                onChange={setPanel}
                className="mb-4"
                items={[
                  { value: "contrast", label: "Accessibility", icon: <Contrast className="h-3.5 w-3.5" /> },
                  { value: "ramps", label: "Ramps", icon: <Layers className="h-3.5 w-3.5" /> },
                  { value: "dark", label: "Dark mode", icon: <Moon className="h-3.5 w-3.5" /> },
                ]}
              />
              {panel === "contrast" ? <ContrastMatrix colors={colors} /> : null}
              {panel === "ramps" ? <RampsPanel colors={colors} /> : null}
              {panel === "dark" ? <DarkModePanel colors={colors} dark={palette.dark} brandName={genome.name} /> : null}
            </Card>
            <AnalysisCard colors={colors} rationale={palette.rationale} />
          </div>
        </div>
      )}

      {dialog === "generate" ? <GenerateDialog genome={genome} onClose={closeDialog} /> : null}
      {dialog === "extract" ? <ExtractDialog colors={colors} onClose={closeDialog} /> : null}
      {dialog === "export" ? <ExportDialog genome={genome} onClose={closeDialog} /> : null}
    </div>
  );
}

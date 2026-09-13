"use client";
import * as React from "react";
import { Images, LayoutGrid, Palette, Sparkles } from "lucide-react";
import { Badge, PageHeader, Tabs } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import { imageryStyleIsEmpty } from "@/lib/imagery/presets";
import { cn } from "@/lib/utils";
import { StyleTab } from "./StyleTab";
import { GenerateTab } from "./GenerateTab";
import { GalleryTab } from "./GalleryTab";
import { MoodboardTab } from "./MoodboardTab";
import { useImageryImages, useReferenceIds } from "./shared";

type TabId = "style" | "generate" | "gallery" | "moodboard";

/**
 * Imagery lab: define the brand's image style, generate on-brand images
 * through the prompt compiler, curate a gallery of references and compose
 * moodboards. Tabs stay mounted so in-flight generations and form state survive
 * switching between them.
 */
export function ImageryLab() {
  const genome = useProject((s) => s.genome);
  const images = useImageryImages(false);
  const refs = useReferenceIds();
  const [tab, setTab] = React.useState<TabId>("style");
  const [moodPicks, setMoodPicks] = React.useState<string[]>(() => genome?.visual.imagery.referenceAssetIds ?? []);
  if (!genome) return null;

  const def = STAGE_BY_ID.imagery;
  const styleEmpty = imageryStyleIsEmpty(genome.visual.imagery);

  return (
    <div>
      <PageHeader
        eyebrow={`Stage ${def.short}`}
        title={def.label}
        description={def.description}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={styleEmpty ? "warning" : "success"}>{styleEmpty ? "style undefined" : "style defined"}</Badge>
            <Badge>{images.length} {images.length === 1 ? "image" : "images"}</Badge>
            <Badge tone={refs.length ? "accent" : "neutral"}>{refs.length} {refs.length === 1 ? "reference" : "references"}</Badge>
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-5"
        items={[
          { value: "style", label: "Style", icon: <Palette className="h-3.5 w-3.5" /> },
          { value: "generate", label: "Generate", icon: <Sparkles className="h-3.5 w-3.5" /> },
          {
            value: "gallery",
            label: (
              <>
                Gallery{images.length ? <span className="ml-1 text-fg-subtle tabular-nums">{images.length}</span> : null}
              </>
            ),
            icon: <Images className="h-3.5 w-3.5" />,
          },
          { value: "moodboard", label: "Moodboard", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
        ]}
      />
      <div className={cn(tab !== "style" && "hidden")} data-tab="style">
        <StyleTab />
      </div>
      <div className={cn(tab !== "generate" && "hidden")} data-tab="generate">
        <GenerateTab />
      </div>
      <div className={cn(tab !== "gallery" && "hidden")} data-tab="gallery">
        <GalleryTab
          onUseInMoodboard={(ids) => {
            setMoodPicks(ids);
            setTab("moodboard");
          }}
        />
      </div>
      <div className={cn(tab !== "moodboard" && "hidden")} data-tab="moodboard">
        <MoodboardTab picks={moodPicks} setPicks={setMoodPicks} />
      </div>
    </div>
  );
}

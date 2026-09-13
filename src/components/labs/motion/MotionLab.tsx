"use client";
import * as React from "react";
import { Clapperboard, SlidersHorizontal, Sparkles } from "lucide-react";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import { useProject } from "@/lib/store/project";
import type { Genome } from "@/lib/genome/schema";
import { LogoAnimationTab } from "./LogoAnimationTab";
import { PrinciplesTab } from "./PrinciplesTab";
import { AiVideoTab } from "./AiVideoTab";
import { initialSettings, type LogoAnimSettings } from "./shared";

type Tab = "logo" | "principles" | "ai";

const TAB_ITEMS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "logo", label: "Logo animation", icon: <Clapperboard className="h-3.5 w-3.5" /> },
  { value: "principles", label: "Principles", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  { value: "ai", label: "AI video", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

function MotionStudio({ genome }: { genome: Genome }) {
  const assets = useProject((s) => s.assets);
  const [tab, setTab] = React.useState<Tab>("logo");
  const [settings, setSettings] = React.useState<LogoAnimSettings>(() => initialSettings(genome, assets));
  const patch = React.useCallback((p: Partial<LogoAnimSettings>) => setSettings((s) => ({ ...s, ...p })), []);
  const def = STAGE_BY_ID.motion;
  return (
    <div>
      <PageHeader eyebrow={`Stage ${def.short}`} title={def.label} description={def.description} actions={<Tabs value={tab} onChange={setTab} items={TAB_ITEMS} />} />
      {tab === "logo" ? <LogoAnimationTab genome={genome} settings={settings} patch={patch} /> : null}
      {tab === "principles" ? <PrinciplesTab genome={genome} settings={settings} onOpenLogo={() => setTab("logo")} /> : null}
      {tab === "ai" ? <AiVideoTab genome={genome} settings={settings} /> : null}
    </div>
  );
}

export function MotionLab() {
  const genome = useProject((s) => s.genome);
  const def = STAGE_BY_ID.motion;
  if (!genome) {
    return (
      <div>
        <PageHeader eyebrow={`Stage ${def.short}`} title={def.label} description={def.description} />
        <EmptyState icon={<Clapperboard className="h-8 w-8" />} title="No project loaded" description="Open a project to animate its logo and generate brand video." />
      </div>
    );
  }
  return <MotionStudio genome={genome} />;
}

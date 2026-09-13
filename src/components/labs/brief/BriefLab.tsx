"use client";
import * as React from "react";
import { FileText, ListChecks } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { DiscoverySummary } from "@/lib/strategy/discovery";
import { BriefDocument } from "./BriefDocument";
import { DiscoveryQuestionnaire } from "./DiscoveryQuestionnaire";
import { BriefHealthCard } from "./BriefHealth";

type View = "brief" | "discovery";

export function BriefLab() {
  const genome = useProject((s) => s.genome);
  const [view, setView] = React.useState<View>("brief");
  const [summary, setSummary] = React.useState<DiscoverySummary | null>(null);
  if (!genome) return null;

  const focusField = (key: string) => {
    setView("brief");
    window.setTimeout(() => {
      const el = document.getElementById(`brief-${key}`);
      if (!el) return;
      const target = el.matches("input,textarea") ? el : (el.querySelector<HTMLElement>("input,textarea") ?? el);
      target.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  };

  return (
    <div className="@container">
      <PageHeader
        eyebrow="Stage 01"
        title="Brief"
        description="Capture the client, goals, audience and deliverables — the ground every later stage stands on."
        actions={
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { value: "brief", label: "Brief", icon: <FileText className="h-3.5 w-3.5" /> },
              { value: "discovery", label: "Discovery questionnaire", icon: <ListChecks className="h-3.5 w-3.5" /> },
            ]}
          />
        }
      />
      <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1fr)_256px] gap-5 items-start">
        <div className="min-w-0 flex flex-col gap-5 @container">
          {view === "brief" ? (
            <BriefDocument genome={genome} summary={summary} onDismissSummary={() => setSummary(null)} onStartDiscovery={() => setView("discovery")} />
          ) : (
            <DiscoveryQuestionnaire
              key={genome.id}
              genome={genome}
              onFinish={(s) => {
                setSummary(s);
                setView("brief");
              }}
            />
          )}
        </div>
        <BriefHealthCard genome={genome} onFocusField={focusField} className="@2xl:sticky @2xl:top-2" />
      </div>
    </div>
  );
}

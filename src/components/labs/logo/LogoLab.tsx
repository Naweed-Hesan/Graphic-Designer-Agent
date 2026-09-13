"use client";
import * as React from "react";
import { Layers, PackageOpen, PenTool, Ruler, Sparkles, Type } from "lucide-react";
import { Badge, PageHeader, Tabs } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import { getLogoVariants } from "@/lib/logo/assets";
import { VARIANT_ORDER } from "@/lib/logo/export";
import { ConceptsTab } from "./ConceptsTab";
import { VectoriseTab } from "./VectoriseTab";
import { WordmarkTab } from "./WordmarkTab";
import { LockupsTab } from "./LockupsTab";
import { RulesTab } from "./RulesTab";
import { ExportTab } from "./ExportTab";

type TabId = "concepts" | "vectorise" | "wordmark" | "lockups" | "rules" | "export";

const TAB_ITEMS: { value: TabId; label: string; icon: React.ReactNode }[] = [
  { value: "concepts", label: "Concepts", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { value: "vectorise", label: "Vectorise", icon: <PenTool className="h-3.5 w-3.5" /> },
  { value: "wordmark", label: "Wordmark", icon: <Type className="h-3.5 w-3.5" /> },
  { value: "lockups", label: "Lockups", icon: <Layers className="h-3.5 w-3.5" /> },
  { value: "rules", label: "Rules", icon: <Ruler className="h-3.5 w-3.5" /> },
  { value: "export", label: "Export", icon: <PackageOpen className="h-3.5 w-3.5" /> },
];

export function LogoLab() {
  const genome = useProject((s) => s.genome);
  const assets = useProject((s) => s.assets);
  const [tab, setTab] = React.useState<TabId>("concepts");
  const [vectorSourceId, setVectorSourceId] = React.useState<string | null>(null);
  const def = STAGE_BY_ID.logo;

  const variants = React.useMemo(() => (genome ? getLogoVariants(genome, assets) : {}), [genome, assets]);
  if (!genome) return null;
  const savedCount = VARIANT_ORDER.filter((k) => variants[k]?.source === "variant").length;

  return (
    <div>
      <PageHeader
        eyebrow={`Stage ${def.short}`}
        title={def.label}
        description={def.description}
        actions={
          <div className="flex items-center gap-1.5" aria-label="Logo progress">
            <Badge tone={variants.mark ? "success" : "neutral"}>Mark {variants.mark ? "✓" : "—"}</Badge>
            <Badge tone={variants.wordmark ? "success" : "neutral"}>Wordmark {variants.wordmark ? "✓" : "—"}</Badge>
            <Badge tone={savedCount === VARIANT_ORDER.length ? "success" : savedCount ? "warning" : "neutral"}>
              {savedCount}/{VARIANT_ORDER.length} variants
            </Badge>
          </div>
        }
      />
      <div className="overflow-x-auto -mx-1 px-1 mb-6">
        <Tabs value={tab} onChange={setTab} items={TAB_ITEMS} />
      </div>

      {tab === "concepts" ? (
        <ConceptsTab
          onVectorise={(id) => {
            setVectorSourceId(id);
            setTab("vectorise");
          }}
          onMarkSet={() => setTab("lockups")}
        />
      ) : null}
      {tab === "vectorise" ? <VectoriseTab sourceId={vectorSourceId} onSourceChange={setVectorSourceId} onGoConcepts={() => setTab("concepts")} onSaved={() => setTab("wordmark")} /> : null}
      {tab === "wordmark" ? <WordmarkTab onSaved={() => setTab("lockups")} /> : null}
      {tab === "lockups" ? <LockupsTab onGoVectorise={() => setTab("vectorise")} onGoWordmark={() => setTab("wordmark")} onSaved={() => setTab("rules")} /> : null}
      {tab === "rules" ? <RulesTab /> : null}
      {tab === "export" ? <ExportTab onGoLockups={() => setTab("lockups")} /> : null}
    </div>
  );
}

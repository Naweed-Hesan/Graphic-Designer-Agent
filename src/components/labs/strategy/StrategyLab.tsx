"use client";
import { CircleDashed, Compass, Flag, Fingerprint, MessageSquareText } from "lucide-react";
import { Badge, Button, Chips, EmptyState, Field, PageHeader } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { Strategy } from "@/lib/genome/schema";
import { NUDGE_THRESHOLD, strategyHealth } from "@/lib/strategy/completeness";
import { COMMON_VALUES } from "@/lib/strategy/suggestions";
import { DraftTextarea, LabCard, SuggestionChips } from "@/components/labs/brief/fields";
import { useStrategyUpdate } from "./useStrategy";
import { PlatformStrip } from "./PlatformStrip";
import { PositioningCard } from "./PositioningCard";
import { ArchetypeCard } from "./ArchetypeCard";
import { PersonalityCard } from "./PersonalityCard";
import { TaglineCard } from "./TaglineCard";
import { ToneCard } from "./ToneCard";

const STATUS_TONE = { todo: "neutral", "in-progress": "warning", done: "success" } as const;
const STATUS_LABEL = { todo: "To do", "in-progress": "In progress", done: "Done" } as const;

export function StrategyLab() {
  const genome = useProject((s) => s.genome);
  const setStage = useProject((s) => s.setStage);
  if (!genome) return null;
  const strategy = genome.strategy;
  const health = strategyHealth(strategy);
  const status = genome.stages.strategy ?? "todo";
  const nudge = health.percent >= NUDGE_THRESHOLD && status === "todo";

  return (
    <div className="@container">
      <PageHeader
        eyebrow="Stage 02"
        title="Strategy"
        description="The brand platform: positioning, values, archetype, personality, tone and tagline. Everything visual is argued from here."
        actions={
          <>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {nudge ? (
              <Button size="sm" variant="secondary" onClick={() => setStage("strategy", "in-progress")}>
                <CircleDashed className="h-3.5 w-3.5 text-warning" /> Mark strategy in progress
              </Button>
            ) : null}
          </>
        }
      />

      <PlatformStrip genome={genome} health={health} />

      {health.done === 0 ? (
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="No platform yet"
          description="Start with positioning and an archetype below, or ask the Creative Director to propose positioning, values and an archetype from the brief."
          className="mt-5"
        />
      ) : null}

      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-5 mt-5">
        <PositioningCard genome={genome} />
        <MissionVisionCard strategy={strategy} />
        <PillarsCard strategy={strategy} />
        <VocabularyCard strategy={strategy} />
        <ArchetypeCard strategy={strategy} className="@3xl:col-span-2" />
        <PersonalityCard strategy={strategy} className="@3xl:col-span-2" />
        <TaglineCard genome={genome} className="@3xl:col-span-2" />
        <ToneCard genome={genome} className="@3xl:col-span-2" />
      </div>
    </div>
  );
}

function MissionVisionCard({ strategy }: { strategy: Strategy }) {
  const set = useStrategyUpdate();
  return (
    <LabCard icon={<Flag />} title="Mission & vision" description="Mission is what the brand does every day; vision is the world it is working toward.">
      <Field label="Mission" hint="present tense">
        <DraftTextarea id="strategy-mission" rows={2} value={strategy.mission} onCommit={(v) => set((s) => void (s.mission = v), "mission updated")} placeholder="Roast coffee that tastes like a clear northern morning." />
      </Field>
      <Field label="Vision" hint="future tense">
        <DraftTextarea id="strategy-vision" rows={2} value={strategy.vision} onCommit={(v) => set((s) => void (s.vision = v), "vision updated")} placeholder="Become the coffee ritual people associate with Iceland." />
      </Field>
    </LabCard>
  );
}

function PillarsCard({ strategy }: { strategy: Strategy }) {
  const set = useStrategyUpdate();
  const setValues = (v: string[]) => set((s) => void (s.values = v), "values updated");
  return (
    <LabCard icon={<Fingerprint />} title="Values & differentiators" description="Three to five values the brand would defend, and the claims only it can make.">
      <Field label="Values" hint="Enter or comma to add">
        <div id="strategy-values">
          <Chips value={strategy.values} onChange={setValues} placeholder="Precision, warmth, curiosity…" />
        </div>
      </Field>
      <SuggestionChips options={COMMON_VALUES} selected={strategy.values} onPick={(v) => setValues([...strategy.values, v])} className="-mt-1" />
      <Field label="Differentiators" hint="specific and provable">
        <div id="strategy-differentiators">
          <Chips value={strategy.differentiators} onChange={(v) => set((s) => void (s.differentiators = v), "differentiators updated")} placeholder="Transparent farm-gate pricing…" />
        </div>
      </Field>
    </LabCard>
  );
}

function VocabularyCard({ strategy }: { strategy: Strategy }) {
  const set = useStrategyUpdate();
  return (
    <LabCard icon={<MessageSquareText />} title="Keywords & names" description="Words that should echo through copy, imagery and prompts — and candidate names if naming is in scope.">
      <Field label="Keywords" hint="feed the prompt compiler">
        <div id="strategy-keywords">
          <Chips value={strategy.keywords} onChange={(v) => set((s) => void (s.keywords = v), "keywords updated")} placeholder="aurora, north, precision…" />
        </div>
      </Field>
      <Field label="Name options" hint="optional">
        <div id="strategy-nameOptions">
          <Chips value={strategy.nameOptions} onChange={(v) => set((s) => void (s.nameOptions = v), "name options updated")} placeholder="Candidate names…" />
        </div>
      </Field>
    </LabCard>
  );
}

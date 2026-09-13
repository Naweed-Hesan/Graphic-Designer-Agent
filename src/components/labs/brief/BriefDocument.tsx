"use client";
import * as React from "react";
import { Building2, Target, Package, ShieldAlert, Swords, Plus, Trash2, FileText, ListChecks, X, Sparkles } from "lucide-react";
import { Button, Chips, EmptyState, Field } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { Genome } from "@/lib/genome/schema";
import { briefHealth } from "@/lib/strategy/completeness";
import { BRIEF_FIELD_LABELS, DELIVERABLE_SUGGESTIONS, type BriefTextKey, type DiscoverySummary } from "@/lib/strategy/discovery";
import { DraftInput, DraftTextarea, LabCard, SuggestionChips } from "./fields";

const LABEL: Record<BriefTextKey, string> = {
  clientName: "client name",
  projectName: "project name",
  industry: "industry",
  description: "description",
  goals: "goals",
  audience: "audience",
  timeline: "timeline",
  constraints: "constraints",
  references: "references",
};

export function BriefDocument({
  genome,
  summary,
  onDismissSummary,
  onStartDiscovery,
}: {
  genome: Genome;
  summary: DiscoverySummary | null;
  onDismissSummary: () => void;
  onStartDiscovery: () => void;
}) {
  const update = useProject((s) => s.update);
  const brief = genome.brief;
  const health = briefHealth(brief);

  const setText = (key: BriefTextKey) => (v: string) =>
    update(
      (g) => {
        g.brief[key] = v;
      },
      { summary: `Brief: ${LABEL[key]} updated`, stage: "brief" },
    );

  const setDeliverables = (items: string[]) =>
    update(
      (g) => {
        g.brief.deliverables = items;
      },
      { summary: "Brief: deliverables updated", stage: "brief" },
    );

  const setCompetitor = (i: number, key: "name" | "note", v: string) =>
    update(
      (g) => {
        if (g.brief.competitors[i]) g.brief.competitors[i][key] = v;
      },
      { summary: `Brief: competitor ${key} updated`, stage: "brief" },
    );

  const addCompetitor = () =>
    update(
      (g) => {
        g.brief.competitors.push({ name: "", note: "" });
      },
      { summary: "Brief: competitor added", stage: "brief" },
    );

  const removeCompetitor = (i: number) =>
    update(
      (g) => {
        g.brief.competitors.splice(i, 1);
      },
      { summary: "Brief: competitor removed", stage: "brief" },
    );

  const focusDescription = () => {
    const el = document.getElementById("brief-description");
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <>
      {summary ? <DiscoveryBanner summary={summary} missing={health.missing.map((m) => m.label)} onDismiss={onDismissSummary} /> : null}

      {health.done === 0 && !summary ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="A blank brief"
          description="Answer the discovery questionnaire one question at a time, or paste raw notes into Description and ask the Creative Director in the panel on the right to structure them into a proper brief."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={onStartDiscovery}>
                <ListChecks className="h-4 w-4" /> Start discovery
              </Button>
              <Button variant="secondary" onClick={focusDescription}>
                Paste notes
              </Button>
            </div>
          }
        />
      ) : null}

      <LabCard icon={<Building2 />} title="Client & project" description="Who the work is for and what, in a sentence or two, it is.">
        <div className="grid grid-cols-1 @xl:grid-cols-3 gap-3">
          <Field label="Client">
            <DraftInput id="brief-clientName" value={brief.clientName} onCommit={setText("clientName")} placeholder="Aurora Roasters" />
          </Field>
          <Field label="Project">
            <DraftInput id="brief-projectName" value={brief.projectName} onCommit={setText("projectName")} placeholder="Aurora Roasters brand identity" />
          </Field>
          <Field label="Industry">
            <DraftInput id="brief-industry" value={brief.industry} onCommit={setText("industry")} placeholder="Specialty coffee" />
          </Field>
        </div>
        <Field label="Description" hint="what they do, for whom, and why it matters">
          <DraftTextarea id="brief-description" rows={4} value={brief.description} onCommit={setText("description")} placeholder="Paste notes here — the Creative Director can turn them into a structured brief." />
        </Field>
      </LabCard>

      <LabCard icon={<Target />} title="Goals & audience" description="What the identity must achieve, and for whom.">
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
          <Field label="Goals" hint="business and brand outcomes">
            <DraftTextarea id="brief-goals" rows={5} value={brief.goals} onCommit={setText("goals")} placeholder="Stand out from generic craft brands; feel premium yet warm…" />
          </Field>
          <Field label="Audience" hint="be specific">
            <DraftTextarea id="brief-audience" rows={5} value={brief.audience} onCommit={setText("audience")} placeholder="Design-literate urban coffee drinkers 25–45…" />
          </Field>
        </div>
      </LabCard>

      <LabCard icon={<Package />} title="Deliverables & timeline" description="Everything that must ship, and when.">
        <Field label="Deliverables" hint="Enter or comma to add">
          <div id="brief-deliverables">
            <Chips value={brief.deliverables} onChange={setDeliverables} placeholder="Logo system, packaging, guidelines…" />
          </div>
        </Field>
        <SuggestionChips options={DELIVERABLE_SUGGESTIONS} selected={brief.deliverables} onPick={(v) => setDeliverables([...brief.deliverables, v])} className="-mt-1" />
        <Field label="Timeline">
          <DraftInput id="brief-timeline" value={brief.timeline} onCommit={setText("timeline")} placeholder="6 weeks; launch on 12 May" />
        </Field>
      </LabCard>

      <LabCard icon={<ShieldAlert />} title="Constraints & references" description="Hard limits to design around, and the things the client points at when they say “like this”.">
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
          <Field label="Constraints" hint="print, budget, legal, legacy">
            <DraftTextarea id="brief-constraints" rows={5} value={brief.constraints} onCommit={setText("constraints")} placeholder="Must print in one colour on kraft paper. Avoid coffee-bean clichés." />
          </Field>
          <Field label="References" hint="brands, moods, eras, places">
            <DraftTextarea id="brief-references" rows={5} value={brief.references} onCommit={setText("references")} placeholder="Nordic minimalism, aurora gradients, old woodcuts…" />
          </Field>
        </div>
      </LabCard>

      <LabCard
        icon={<Swords />}
        title="Competitive landscape"
        description="Who the brand will be seen next to, and how it should feel different."
        actions={
          <Button variant="secondary" size="sm" onClick={addCompetitor}>
            <Plus className="h-3.5 w-3.5" /> Add competitor
          </Button>
        }
      >
        {brief.competitors.length === 0 ? (
          <div id="brief-competitors" className="inset px-4 py-6 text-sm text-fg-muted text-center">
            No competitors listed yet. Add the two or three the client mentions most.
          </div>
        ) : (
          <ul id="brief-competitors" className="flex flex-col gap-2">
            {brief.competitors.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <DraftInput className="@lg:w-2/5" value={c.name} onCommit={(v) => setCompetitor(i, "name", v)} placeholder="Competitor" aria-label={`Competitor ${i + 1} name`} />
                <DraftInput value={c.note} onCommit={(v) => setCompetitor(i, "note", v)} placeholder="How they look — and how we should differ" aria-label={`Competitor ${i + 1} note`} />
                <Button variant="ghost" size="icon" onClick={() => removeCompetitor(i)} title="Remove competitor" aria-label={`Remove competitor ${i + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </LabCard>
    </>
  );
}

function DiscoveryBanner({ summary, missing, onDismiss }: { summary: DiscoverySummary; missing: string[]; onDismiss: () => void }) {
  const touched = summary.touched.map((k) => BRIEF_FIELD_LABELS[k]);
  return (
    <div className="surface p-4 flex items-start gap-3 border-accent/40">
      <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium">Discovery complete</div>
        <p className="text-fg-muted mt-0.5">
          {summary.answered} answered, {summary.skipped} skipped · brief health {summary.before}% → <span className="text-fg">{summary.after}%</span>
          {touched.length ? ` · updated ${touched.join(", ").toLowerCase()}` : " · nothing changed"}.
        </p>
        {missing.length ? <p className="text-fg-subtle text-xs mt-1">Still missing: {missing.join(", ").toLowerCase()}.</p> : <p className="text-success text-xs mt-1">Every field is filled.</p>}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onDismiss} title="Dismiss" aria-label="Dismiss discovery summary">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

"use client";
import { Compass, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { Archetype, Strategy } from "@/lib/genome/schema";
import { ARCHETYPES } from "@/lib/genome/archetypes";
import { cn } from "@/lib/utils";
import { LabCard } from "@/components/labs/brief/fields";
import { useStrategyUpdate } from "./useStrategy";

type ArchetypeId = Exclude<Archetype, "">;

const lc = (name: string) => name.replace(/^The /, "the ");

export function ArchetypeCard({ strategy, className }: { strategy: Strategy; className?: string }) {
  const set = useStrategyUpdate();
  const primary = ARCHETYPES.find((a) => a.id === strategy.archetype);
  const secondary = ARCHETYPES.find((a) => a.id === strategy.secondaryArchetype);

  const choosePrimary = (id: ArchetypeId, name: string) => {
    if (strategy.archetype === id) return;
    set((s) => {
      if (s.secondaryArchetype === id) s.secondaryArchetype = s.archetype;
      s.archetype = id;
    }, `archetype → ${name}`);
  };
  const chooseSecondary = (id: ArchetypeId, name: string) => {
    if (strategy.secondaryArchetype === id) {
      set((s) => void (s.secondaryArchetype = ""), "secondary archetype cleared");
      return;
    }
    if (strategy.archetype === id && !strategy.secondaryArchetype) return;
    set((s) => {
      if (s.archetype === id) s.archetype = s.secondaryArchetype;
      s.secondaryArchetype = id;
    }, `secondary archetype → ${name}`);
  };
  const clear = () =>
    set((s) => {
      s.archetype = "";
      s.secondaryArchetype = "";
    }, "archetype cleared");

  const guidance = primary
    ? `Lead with ${lc(primary.name)}: ${primary.voice.toLowerCase()}.` +
      (secondary ? ` Temper it with ${lc(secondary.name)}: ${secondary.voice.toLowerCase()}.` : " Add a secondary archetype to soften or sharpen the edges.")
    : "";

  return (
    <LabCard
      icon={<Compass />}
      title="Archetype"
      description="Click a card to set the primary archetype; “Secondary” adds a supporting one. Two is plenty."
      className={className}
      actions={
        primary || secondary ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-4 gap-2">
        {ARCHETYPES.map((a) => {
          const isPrimary = a.id === strategy.archetype;
          const isSecondary = a.id === strategy.secondaryArchetype;
          return (
            <div key={a.id} className="relative group">
              <button
                type="button"
                onClick={() => choosePrimary(a.id, a.name)}
                aria-pressed={isPrimary}
                aria-label={`${a.name}${isPrimary ? " (primary)" : isSecondary ? " (secondary)" : ""}`}
                className={cn(
                  "w-full h-full text-left surface-2 p-3 pb-9 transition-colors cursor-pointer hover:border-line-strong",
                  isPrimary && "border-accent bg-accent-soft/40 hover:border-accent",
                  isSecondary && "border-info/60 border-dashed hover:border-info",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-tight">{a.name}</span>
                  {isPrimary ? <Badge tone="accent">Primary</Badge> : isSecondary ? <Badge tone="info">Secondary</Badge> : null}
                </div>
                <div className="text-xs text-fg-muted mt-1">{a.drive}</div>
                <div className="text-xs text-fg-subtle italic mt-1">{a.voice}</div>
                <div className="text-[11px] text-fg-subtle mt-2 leading-snug">
                  {a.examples} · {a.colors}
                </div>
              </button>
              <button
                type="button"
                onClick={() => chooseSecondary(a.id, a.name)}
                className={cn(
                  "absolute bottom-2 right-2 rounded-md px-2 h-6 text-[11px] font-medium transition-opacity cursor-pointer",
                  "text-fg-muted hover:text-fg bg-bg-elev border border-line hover:border-line-strong",
                  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  isSecondary && "opacity-100 text-info border-info/60",
                )}
                aria-label={isSecondary ? `Remove ${a.name} as secondary archetype` : `Set ${a.name} as secondary archetype`}
              >
                {isSecondary ? "Secondary ✓" : "Set as secondary"}
              </button>
            </div>
          );
        })}
      </div>

      {primary ? (
        <div className="inset p-4 grid grid-cols-1 @2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
          <div>
            <div className="label mb-1.5">Voice guidance</div>
            <p className="text-sm leading-relaxed">{guidance}</p>
          </div>
          <dl className="text-xs text-fg-muted flex flex-col gap-1">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-fg">Drive</dt>
              <dd>{primary.drive}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-fg">Voice</dt>
              <dd>{primary.voice}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-fg">Colour cues</dt>
              <dd>{primary.colors}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-fg">In the wild</dt>
              <dd>{primary.examples}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-xs text-fg-subtle">Pick a primary archetype to see voice guidance.</p>
      )}
    </LabCard>
  );
}

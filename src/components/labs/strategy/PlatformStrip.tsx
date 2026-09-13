"use client";
import { Compass } from "lucide-react";
import { Badge, Progress } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { ARCHETYPES } from "@/lib/genome/archetypes";
import type { Health } from "@/lib/strategy/completeness";
import { fontStack } from "@/lib/type/fonts";

export function PlatformStrip({ genome, health }: { genome: Genome; health: Health }) {
  const s = genome.strategy;
  const primary = ARCHETYPES.find((a) => a.id === s.archetype);
  const secondary = ARCHETYPES.find((a) => a.id === s.secondaryArchetype);
  const display = genome.visual.typography.display;

  return (
    <div className="surface p-5 grid grid-cols-1 @3xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6">
      <div className="min-w-0 flex flex-col gap-3">
        <div className="label">Brand platform</div>
        <p className="text-[15px] leading-relaxed line-clamp-3">
          {s.positioning || <span className="text-fg-subtle">No positioning yet — write one below, or open the builder.</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {primary ? (
            <Badge tone="accent">
              <Compass className="h-3 w-3" /> {primary.name}
            </Badge>
          ) : (
            <Badge>No archetype</Badge>
          )}
          {secondary ? <Badge tone="info">{secondary.name}</Badge> : null}
          {s.values.length ? <span className="w-px h-4 bg-line mx-1" aria-hidden /> : null}
          {s.values.map((v) => (
            <Badge key={v}>{v}</Badge>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex flex-col gap-3 @3xl:border-l @3xl:border-line @3xl:pl-6">
        <div className="label">Tagline</div>
        <div className="text-2xl leading-tight" style={{ fontFamily: fontStack(display.family, display.fallback) }}>
          {s.tagline || <span className="text-fg-subtle text-sm font-sans">No tagline yet</span>}
        </div>
        <div className="mt-auto pt-2">
          <div className="flex items-center justify-between text-xs text-fg-muted mb-1.5">
            <span>Platform completeness</span>
            <span className="font-mono tabular-nums text-fg">{health.percent}%</span>
          </div>
          <Progress value={health.percent} />
          {health.missing.length ? (
            <p className="text-[11px] text-fg-subtle mt-1.5 truncate" title={health.missing.map((m) => m.label).join(", ")}>
              Missing: {health.missing.map((m) => m.label.toLowerCase()).join(", ")}
            </p>
          ) : (
            <p className="text-[11px] text-success mt-1.5">Every part of the platform is filled.</p>
          )}
        </div>
      </div>
    </div>
  );
}

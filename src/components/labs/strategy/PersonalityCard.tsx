"use client";
import { Gauge, RotateCcw } from "lucide-react";
import { Button, Slider } from "@/components/ui";
import type { PersonalityAxis, Strategy } from "@/lib/genome/schema";
import { ensureAxes, labelAnchor, personalityReadout, pointsAttr, radarPoints, readAxis, sameAxes } from "@/lib/strategy/personality";
import { cn } from "@/lib/utils";
import { LabCard, useDraft } from "@/components/labs/brief/fields";
import { useStrategyUpdate } from "./useStrategy";

const DRAFT_OPTIONS = { delay: 350, equals: sameAxes };

export function PersonalityCard({ strategy, className }: { strategy: Strategy; className?: string }) {
  const set = useStrategyUpdate();
  const axes = ensureAxes(strategy.personality);
  const [draft, setDraft] = useDraft(axes, (v) => set((s) => void (s.personality = v), "personality adjusted"), DRAFT_OPTIONS);
  const setValue = (id: string, value: number) => setDraft(draft.map((a) => (a.id === id ? { ...a, value } : a)));
  const reset = () => set((s) => void (s.personality = ensureAxes(s.personality).map((a) => ({ ...a, value: 50 }))), "personality reset");
  const readout = personalityReadout(draft);

  return (
    <LabCard
      icon={<Gauge />}
      title="Personality"
      description="Where the brand sits on six tensions. The readout and radar update as you drag; history records one entry per adjustment."
      className={className}
      actions={
        <Button variant="ghost" size="sm" onClick={reset} disabled={draft.every((a) => a.value === 50)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      }
    >
      <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
        <div className="flex flex-col gap-4">
          {draft.map((a) => {
            const r = readAxis(a);
            return (
              <div key={a.id}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={cn(r.lean === "left" ? "text-fg font-medium" : "text-fg-muted")}>{a.left}</span>
                  <span className="font-mono text-[10px] text-fg-subtle tabular-nums">{a.value}</span>
                  <span className={cn(r.lean === "right" ? "text-fg font-medium" : "text-fg-muted")}>{a.right}</span>
                </div>
                <Slider min={0} max={100} step={1} value={a.value} onChange={(e) => setValue(a.id, Number(e.target.value))} aria-label={`${a.left} to ${a.right}`} />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 @2xl:border-l @2xl:border-line @2xl:pl-6">
          <div>
            <div className="label mb-1.5">Personality readout</div>
            <p className="font-display text-xl leading-snug">{readout}</p>
          </div>
          <Radar axes={draft} readout={readout} />
          <p className="text-[11px] text-fg-subtle text-center">Centre is the left pole of each axis; the rim is the right.</p>
        </div>
      </div>
    </LabCard>
  );
}

function Radar({ axes, readout }: { axes: PersonalityAxis[]; readout: string }) {
  // Wider than tall so the horizontal pole labels never clip at the edges.
  const width = 320;
  const height = 236;
  const cx = width / 2;
  const cy = height / 2;
  const r = 82;
  const n = axes.length;
  const data = radarPoints(axes.map((a) => a.value), cx, cy, r);
  const rim = radarPoints(axes.map(() => 100), cx, cy, r);
  const labels = radarPoints(axes.map(() => 100), cx, cy, r + 13);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[320px] mx-auto" role="img" aria-label={`Personality radar. ${readout}`}>
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={pointsAttr(radarPoints(axes.map(() => v), cx, cy, r))} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {rim.map((p, i) => (
        <line key={axes[i].id} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--line)" strokeWidth={1} />
      ))}
      <polygon points={pointsAttr(data)} fill="var(--accent)" fillOpacity={0.16} stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {data.map((p, i) => (
        <circle key={axes[i].id} cx={p.x} cy={p.y} r={4} fill="var(--accent)" stroke="var(--bg-elev)" strokeWidth={2}>
          <title>{`${axes[i].left} ↔ ${axes[i].right}: ${axes[i].value}`}</title>
        </circle>
      ))}
      {labels.map((p, i) => (
        <text key={axes[i].id} x={p.x} y={p.y} textAnchor={labelAnchor(i, n)} dominantBaseline="middle" fontSize={10} fill="var(--fg-muted)">
          {axes[i].right}
        </text>
      ))}
    </svg>
  );
}

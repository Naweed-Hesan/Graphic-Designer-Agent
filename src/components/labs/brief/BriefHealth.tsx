"use client";
import { HeartPulse, Check, Circle, CircleDashed } from "lucide-react";
import { Badge, Button, Card, Progress } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { Genome } from "@/lib/genome/schema";
import { briefHealth, briefWordCounts, NUDGE_THRESHOLD } from "@/lib/strategy/completeness";
import { cn } from "@/lib/utils";

const STATUS_TONE = { todo: "neutral", "in-progress": "warning", done: "success" } as const;
const STATUS_LABEL = { todo: "To do", "in-progress": "In progress", done: "Done" } as const;

export function BriefHealthCard({ genome, onFocusField, className }: { genome: Genome; onFocusField: (key: string) => void; className?: string }) {
  const setStage = useProject((s) => s.setStage);
  const health = briefHealth(genome.brief);
  const words = briefWordCounts(genome.brief);
  const status = genome.stages.brief ?? "todo";
  const showNudge = health.percent >= NUDGE_THRESHOLD && status === "todo";

  return (
    <Card className={cn("p-4 flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <HeartPulse className="h-4 w-4 text-accent" /> Brief health
        </h2>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{health.percent}%</span>
          <span className="text-xs text-fg-muted">
            {health.done}/{health.total} fields
          </span>
        </div>
        <Progress value={health.percent} className="mt-2" />
      </div>

      {showNudge ? (
        <div className="inset p-3 flex flex-col gap-2">
          <p className="text-[13px] leading-snug">Looking solid. Mark the brief as in progress so the studio tracks it.</p>
          <Button size="sm" variant="secondary" onClick={() => setStage("brief", "in-progress")}>
            <CircleDashed className="h-3.5 w-3.5 text-warning" /> Mark brief in progress
          </Button>
        </div>
      ) : null}

      <div>
        <div className="label mb-2">{health.missing.length ? `Missing (${health.missing.length})` : "Checklist"}</div>
        <ul className="flex flex-col gap-0.5">
          {health.items.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => onFocusField(it.key)}
                className={cn("w-full flex items-center gap-2 rounded-md px-1.5 h-7 text-[13px] text-left transition-colors cursor-pointer hover:bg-bg-elev-2", it.done ? "text-fg-muted" : "text-fg")}
                title={`Go to ${it.label.toLowerCase()}`}
              >
                {it.done ? <Check className="h-3.5 w-3.5 text-success shrink-0" /> : <Circle className="h-3.5 w-3.5 text-fg-subtle shrink-0" />}
                <span className="truncate">{it.label}</span>
                {it.hint ? <span className="ml-auto text-[11px] text-warning truncate">{it.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="label mb-2">Word counts</div>
        <dl className="flex flex-col gap-1 text-[13px]">
          {words.rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2">
              <dt className="text-fg-muted">{r.label}</dt>
              <dd className={cn("font-mono text-xs tabular-nums", r.words ? "text-fg" : "text-fg-subtle")}>{r.words}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 border-t border-line pt-1 mt-0.5">
            <dt className="text-fg-muted">Total</dt>
            <dd className="font-mono text-xs tabular-nums">{words.total}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

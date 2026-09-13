"use client";
import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Minus, SkipForward, Plus, Trash2, Flag } from "lucide-react";
import { Button, Chips, Field, Input, Kbd, Progress, Textarea } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { Brief, Genome } from "@/lib/genome/schema";
import { briefHealth } from "@/lib/strategy/completeness";
import {
  DISCOVERY_QUESTIONS,
  applyAnswer,
  changedBriefFields,
  initialAnswer,
  isEmptyAnswer,
  sameBrief,
  type Competitor,
  type DiscoveryAnswer,
  type DiscoveryQuestion,
  type DiscoverySummary,
} from "@/lib/strategy/discovery";
import { cn } from "@/lib/utils";
import { SuggestionChips } from "./fields";

const TOTAL = DISCOVERY_QUESTIONS.length;

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** Append-style questions can retract their contribution when the answer is cleared. */
function isAppend(q: DiscoveryQuestion): boolean {
  return (q.kind === "text" || q.kind === "paragraph" || q.kind === "chips") && q.mode === "append";
}

export function DiscoveryQuestionnaire({ genome, onFinish }: { genome: Genome; onFinish: (summary: DiscoverySummary) => void }) {
  const update = useProject((s) => s.update);
  const [step, setStep] = React.useState(0);
  const [drafts, setDrafts] = React.useState<Record<string, DiscoveryAnswer>>({});
  const [applied, setApplied] = React.useState<Record<string, DiscoveryAnswer>>({});
  const [skipped, setSkipped] = React.useState<string[]>([]);
  const [startBrief] = React.useState<Brief>(genome.brief);
  const [startPercent] = React.useState(() => briefHealth(genome.brief).percent);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const brief = genome.brief;
  const q = DISCOVERY_QUESTIONS[step];
  const answer = drafts[q.id] ?? applied[q.id] ?? initialAnswer(brief, q);
  const setAnswer = (a: DiscoveryAnswer) => setDrafts((d) => ({ ...d, [q.id]: a }));

  /** Fold the current answer into the Genome. Returns the brief as it will be after the write. */
  const commit = (): Brief => {
    const previous = applied[q.id];
    const empty = isEmptyAnswer(answer);
    if (empty && !(previous && isAppend(q))) return brief; // nothing to write; keep whatever is there
    const next = applyAnswer(brief, q, answer, previous);
    if (!sameBrief(next, brief)) {
      update(
        (g) => {
          g.brief = applyAnswer(g.brief, q, answer, previous);
          if (q.kind === "fields" && g.name === "Untitled brand" && g.brief.clientName) g.name = g.brief.clientName;
        },
        { summary: `Brief: ${q.title.toLowerCase()} captured in discovery`, stage: "brief" },
      );
    }
    setApplied((a) => (empty ? omit(a, q.id) : { ...a, [q.id]: answer }));
    setDrafts((d) => omit(d, q.id));
    if (!empty) setSkipped((s) => s.filter((id) => id !== q.id));
    return next;
  };

  const goTo = (n: number) => {
    setStep(Math.max(0, Math.min(TOTAL - 1, n)));
    bodyRef.current?.scrollIntoView({ block: "nearest" });
  };

  const finish = (after: Brief) => {
    const answeredIds = new Set(Object.keys(applied));
    if (!isEmptyAnswer(answer)) answeredIds.add(q.id);
    onFinish({
      answered: answeredIds.size,
      skipped: skipped.filter((id) => !answeredIds.has(id)).length,
      touched: changedBriefFields(startBrief, after),
      before: startPercent,
      after: briefHealth(after).percent,
    });
  };

  const next = () => {
    const after = commit();
    if (step === TOTAL - 1) finish(after);
    else goTo(step + 1);
  };
  const back = () => {
    commit();
    goTo(step - 1);
  };
  const skip = () => {
    setSkipped((s) => (s.includes(q.id) ? s : [...s, q.id]));
    setDrafts((d) => omit(d, q.id));
    if (step === TOTAL - 1) finish(brief);
    else goTo(step + 1);
  };
  const jump = (n: number) => {
    if (n === step) return;
    commit();
    goTo(n);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.isDefaultPrevented()) return;
    const tag = (e.target as HTMLElement).tagName;
    const accelerator = e.metaKey || e.ctrlKey;
    if (accelerator || (tag === "INPUT" && q.kind !== "competitors")) {
      e.preventDefault();
      next();
    }
  };

  const isLast = step === TOTAL - 1;
  const answeredCount = Object.keys(applied).length;
  const multiline = q.kind === "paragraph" || q.kind === "chips" || q.kind === "competitors";

  return (
    <div ref={bodyRef} className="surface overflow-hidden flex min-h-[520px]">
      <ol className="hidden @2xl:flex flex-col w-52 shrink-0 border-r border-line py-3 bg-bg-elev-2/40" aria-label="Questions">
        {DISCOVERY_QUESTIONS.map((it, i) => {
          const done = Boolean(applied[it.id]);
          const wasSkipped = !done && skipped.includes(it.id);
          const current = i === step;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "w-full text-left flex items-center gap-2.5 px-4 h-8 text-[13px] transition-colors cursor-pointer",
                  current ? "text-fg bg-accent-soft" : "text-fg-muted hover:text-fg hover:bg-bg-elev-2",
                )}
              >
                <span className="w-4 flex justify-center shrink-0">
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : wasSkipped ? (
                    <Minus className="h-3.5 w-3.5 text-fg-subtle" />
                  ) : (
                    <span className={cn("font-mono text-[10px]", current ? "text-accent" : "text-fg-subtle")}>{String(i + 1).padStart(2, "0")}</span>
                  )}
                </span>
                <span className="truncate">{it.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex-1 min-w-0 p-6 flex flex-col" onKeyDown={onKeyDown}>
        <div className="flex items-center justify-between gap-3">
          <span className="label">
            Question {step + 1} of {TOTAL}
          </span>
          <span className="text-[11px] text-fg-subtle">
            {answeredCount} answered · {skipped.length} skipped
          </span>
        </div>
        <Progress value={(step / TOTAL) * 100} className="mt-2" />
        {/* Compact step dots for narrow layouts where the rail is hidden */}
        <ol className="flex @2xl:hidden items-center gap-1 mt-3" aria-label="Questions">
          {DISCOVERY_QUESTIONS.map((it, i) => {
            const done = Boolean(applied[it.id]);
            const current = i === step;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  title={`${i + 1}. ${it.title}`}
                  aria-label={`${i + 1}. ${it.title}`}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "h-2 rounded-full transition-[width,background] cursor-pointer",
                    current ? "w-5 bg-accent" : done ? "w-2 bg-success/70 hover:bg-success" : "w-2 bg-line-strong hover:bg-fg-subtle",
                  )}
                />
              </li>
            );
          })}
        </ol>

        <h2 className="font-display text-[26px] leading-snug tracking-tight mt-6">{q.prompt}</h2>
        {q.hint ? <p className="text-sm text-fg-muted mt-1.5 max-w-xl">{q.hint}</p> : null}

        <div className="mt-5" key={q.id}>
          <StepInput q={q} answer={answer} onChange={setAnswer} />
        </div>

        <div className="mt-auto pt-6 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={back} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="ghost" size="sm" onClick={skip}>
            <SkipForward className="h-4 w-4" /> Skip
          </Button>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] text-fg-subtle">
            {multiline ? (
              <>
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd> to continue
              </>
            ) : (
              <>
                <Kbd>↵</Kbd> to continue
              </>
            )}
          </span>
          <Button size="sm" onClick={next}>
            {isLast ? (
              <>
                <Flag className="h-4 w-4" /> Finish
              </>
            ) : (
              <>
                Next <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepInput({ q, answer, onChange }: { q: DiscoveryQuestion; answer: DiscoveryAnswer; onChange: (a: DiscoveryAnswer) => void }) {
  switch (q.kind) {
    case "text": {
      const text = answer.kind === "text" ? answer.text : "";
      return <Input autoFocus value={text} onChange={(e) => onChange({ kind: "text", text: e.target.value })} placeholder={q.placeholder} aria-label={q.prompt} />;
    }
    case "paragraph": {
      const text = answer.kind === "text" ? answer.text : "";
      return <Textarea autoFocus rows={5} value={text} onChange={(e) => onChange({ kind: "text", text: e.target.value })} placeholder={q.placeholder} aria-label={q.prompt} />;
    }
    case "fields": {
      const values = answer.kind === "fields" ? answer.values : {};
      return (
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
          {q.fields.map((f, i) => (
            <Field key={f.key} label={f.label} className={i === q.fields.length - 1 && q.fields.length % 2 === 1 ? "@lg:col-span-2" : undefined}>
              <Input autoFocus={i === 0} value={values[f.key] ?? ""} onChange={(e) => onChange({ kind: "fields", values: { ...values, [f.key]: e.target.value } })} placeholder={f.placeholder} />
            </Field>
          ))}
        </div>
      );
    }
    case "chips": {
      const items = answer.kind === "list" ? answer.items : [];
      return (
        <div className="flex flex-col gap-3">
          <Chips value={items} onChange={(v) => onChange({ kind: "list", items: v })} placeholder="Type and press Enter to add" />
          <SuggestionChips options={q.suggestions} selected={items} onPick={(v) => onChange({ kind: "list", items: [...items, v] })} label="Pick" />
        </div>
      );
    }
    case "competitors": {
      const rows = answer.kind === "competitors" ? answer.rows : [];
      return <CompetitorRows rows={rows} onChange={(r) => onChange({ kind: "competitors", rows: r })} />;
    }
  }
}

function CompetitorRows({ rows, onChange }: { rows: Competitor[]; onChange: (rows: Competitor[]) => void }) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const shown = rows.length ? rows : [{ name: "", note: "" }];

  const set = (i: number, key: keyof Competitor, v: string) => onChange(shown.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const add = () => {
    onChange([...shown, { name: "", note: "" }]);
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("input[data-col='name']");
      inputs?.[inputs.length - 1]?.focus();
    });
  };
  const remove = (i: number) => onChange(shown.filter((_, j) => j !== i));

  const onRowKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number, col: keyof Competitor) => {
    if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (col === "name") {
      listRef.current?.querySelector<HTMLInputElement>(`input[data-row='${i}'][data-col='note']`)?.focus();
    } else if (shown[i].name.trim()) {
      add();
    }
  };

  return (
    <div ref={listRef} className="flex flex-col gap-2">
      {shown.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <Input
            autoFocus={i === 0}
            data-row={i}
            data-col="name"
            className="@lg:w-2/5"
            value={r.name}
            onChange={(e) => set(i, "name", e.target.value)}
            onKeyDown={(e) => onRowKey(e, i, "name")}
            placeholder="Competitor"
            aria-label={`Competitor ${i + 1} name`}
          />
          <Input
            data-row={i}
            data-col="note"
            value={r.note}
            onChange={(e) => set(i, "note", e.target.value)}
            onKeyDown={(e) => onRowKey(e, i, "note")}
            placeholder="How they look — and how we should differ"
            aria-label={`Competitor ${i + 1} note`}
          />
          <Button variant="ghost" size="icon" onClick={() => remove(i)} disabled={shown.length === 1 && !r.name && !r.note} title="Remove" aria-label={`Remove competitor ${i + 1}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add another
        </Button>
      </div>
    </div>
  );
}

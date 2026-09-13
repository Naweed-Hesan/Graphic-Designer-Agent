"use client";
/**
 * Small building blocks shared by the Brief and Strategy labs:
 * a debounced draft hook, draft-aware inputs, a compact card and suggestion chips.
 */
import * as React from "react";
import { Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface DraftOptions<T> {
  /** ms of idle time before the draft is committed (default 300) */
  delay?: number;
  /** equality used to detect external changes (default Object.is) */
  equals?: (a: T, b: T) => boolean;
}

/**
 * Keeps a local draft of a Genome value so typing stays instant, commits it after
 * `delay` ms of idle time, resyncs when the value changes elsewhere (assistant,
 * questionnaire, another field), and offers `flush()` for blur/unmount.
 */
export function useDraft<T>(value: T, commit: (v: T) => void, options?: DraftOptions<T>): readonly [T, (v: T) => void, () => void] {
  const delay = options?.delay ?? 300;
  const equals = options?.equals ?? Object.is;
  const [draft, setDraft] = React.useState(value);
  const [synced, setSynced] = React.useState(value);
  if (!equals(value, synced)) {
    // The Genome moved underneath us (AI edit, questionnaire, undo) — adopt it.
    setSynced(value);
    setDraft(value);
  }

  const commitRef = React.useRef(commit);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    commitRef.current = commit;
  });

  React.useEffect(() => {
    if (equals(draft, value)) return;
    const t = setTimeout(() => {
      timer.current = null;
      commitRef.current(draft);
    }, delay);
    timer.current = t;
    return () => {
      clearTimeout(t);
      if (timer.current === t) timer.current = null;
    };
  }, [draft, value, delay, equals]);

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!equals(draft, value)) commit(draft);
  };

  // Commit anything still pending when the field unmounts (e.g. switching labs).
  const flushRef = React.useRef(flush);
  React.useEffect(() => {
    flushRef.current = flush;
  });
  React.useEffect(() => () => flushRef.current(), []);

  return [draft, setDraft, flush] as const;
}

type DraftInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onCommit: (v: string) => void };

export function DraftInput({ value, onCommit, onBlur, ...props }: DraftInputProps) {
  const [draft, setDraft, flush] = useDraft(value, onCommit);
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        flush();
        onBlur?.(e);
      }}
    />
  );
}

type DraftTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & { value: string; onCommit: (v: string) => void };

export function DraftTextarea({ value, onCommit, onBlur, ...props }: DraftTextareaProps) {
  const [draft, setDraft, flush] = useDraft(value, onCommit);
  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        flush();
        onBlur?.(e);
      }}
    />
  );
}

export function LabCard({
  id,
  icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("surface p-5 flex flex-col gap-4", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            {icon ? <span className="text-accent [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
            {title}
          </h2>
          {description ? <p className="text-xs text-fg-muted mt-1 max-w-xl">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** One-click suggestions that are not yet in `selected`. */
export function SuggestionChips({ options, selected, onPick, label = "Suggestions", className }: { options: string[]; selected: string[]; onPick: (v: string) => void; label?: string; className?: string }) {
  const lower = new Set(selected.map((s) => s.trim().toLowerCase()));
  const remaining = options.filter((o) => !lower.has(o.toLowerCase()));
  if (!remaining.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[11px] text-fg-subtle mr-1">{label}</span>
      {remaining.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[12px] text-fg-muted hover:text-fg hover:border-line-strong hover:bg-bg-elev-2 transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          {o}
        </button>
      ))}
    </div>
  );
}

"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3 mb-4", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-fg-muted mt-0.5 max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow ? <div className="label mb-1">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-fg-muted mt-1 max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Badge({ className, tone = "neutral", children }: { className?: string; tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-bg-elev-2 text-fg-muted border-line",
    accent: "bg-accent-soft text-accent border-transparent",
    success: "bg-success/15 text-success border-transparent",
    warning: "bg-warning/15 text-warning border-transparent",
    danger: "bg-danger/15 text-danger border-transparent",
    info: "bg-info/15 text-info border-transparent",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", tones[tone], className)}>{children}</span>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-bg-inset px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 rounded-full border-2 border-line-strong border-t-accent animate-[spin_0.8s_linear_infinite]", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inset grid-dots flex flex-col items-center justify-center text-center p-10 gap-2", className)}>
      {icon ? <div className="text-fg-subtle mb-1">{icon}</div> : null}
      <div className="font-medium">{title}</div>
      {description ? <p className="text-sm text-fg-muted max-w-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg bg-bg-inset border border-line p-0.5", className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 h-7 text-[13px] font-medium transition-colors cursor-pointer",
            value === it.value ? "bg-bg-elev text-fg shadow-sm" : "text-fg-muted hover:text-fg",
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({ open, onClose, title, description, children, className, wide }: { open: boolean; onClose: () => void; title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in" onClick={onClose} />
      <div className={cn("relative surface shadow-card w-full max-h-[90vh] overflow-y-auto animate-in", wide ? "max-w-4xl" : "max-w-lg", className)}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <p className="text-sm text-fg-muted mt-0.5">{description}</p> : null}
          </div>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg rounded-md p-1 cursor-pointer" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Chips({ value, onChange, placeholder, id, ariaLabel }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string; ariaLabel?: string }) {
  const [draft, setDraft] = React.useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg-inset px-2 py-1.5 min-h-9 focus-within:border-line-strong">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-bg-elev-2 border border-line px-2 py-0.5 text-[12px]">
          {v}
          <button className="text-fg-subtle hover:text-fg cursor-pointer" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-fg-subtle"
      />
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-bg-inset overflow-hidden", className)}>
      <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactElement<{ title?: string }> }) {
  return React.cloneElement(children, { title: label });
}

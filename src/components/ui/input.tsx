"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A Field publishes an id + label name; the first form control inside it that
 * has no id of its own claims the id so `<label for>` resolves even when the
 * control is wrapped in other elements.
 */
export const FieldContext = React.createContext<{ id: string; label: string } | null>(null);

/**
 * Resolves the id / accessible name for a form control: an explicit id wins,
 * otherwise the enclosing Field's id and label are used so `<label for>`
 * resolves even when the control is wrapped in other elements. A Field should
 * wrap a single control.
 */
export function useFieldControl(explicitId?: string, explicitLabel?: string): { id?: string; ariaLabel?: string } {
  const ctx = React.useContext(FieldContext);
  if (explicitId || !ctx) return { id: explicitId, ariaLabel: explicitLabel };
  return { id: ctx.id, ariaLabel: explicitLabel ?? (ctx.label || undefined) };
}

const base =
  "w-full rounded-md border border-line bg-bg-inset px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, id, "aria-label": ariaLabel, ...props }, ref) => {
  const ctl = useFieldControl(id, ariaLabel);
  return <input ref={ref} id={ctl.id} aria-label={ctl.ariaLabel} className={cn(base, "h-9", className)} {...props} />;
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, id, "aria-label": ariaLabel, ...props }, ref) => {
  const ctl = useFieldControl(id, ariaLabel);
  return <textarea ref={ref} id={ctl.id} aria-label={ctl.ariaLabel} className={cn(base, "py-2 min-h-[80px] leading-relaxed resize-y", className)} {...props} />;
});
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, id, "aria-label": ariaLabel, ...props }, ref) => {
  const ctl = useFieldControl(id, ariaLabel);
  return (
    <select
      ref={ref}
      id={ctl.id}
      aria-label={ctl.ariaLabel}
      className={cn(base, "h-9 pr-8 appearance-none bg-no-repeat bg-[right_8px_center]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export function Label({ className, children, hint, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn("flex items-baseline justify-between gap-2 text-[13px] font-medium text-fg-muted mb-1.5", className)} {...props}>
      <span>{children}</span>
      {hint ? <span className="text-[11px] font-normal text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

export function Field({ label, hint, children, className, htmlFor }: { label: React.ReactNode; hint?: string; children: React.ReactNode; className?: string; htmlFor?: string }) {
  const auto = React.useId();
  // Prefer an explicit id, then an id on a direct child; otherwise the first control inside claims the generated id.
  const childId = React.Children.toArray(children).map((c) => (React.isValidElement<{ id?: string }>(c) && typeof c.type !== "string" ? c.props.id : undefined)).find(Boolean);
  const id = htmlFor ?? childId ?? auto;
  const ctx = React.useMemo(() => ({ id, label: typeof label === "string" ? label : "" }), [id, label]);
  return (
    <FieldContext.Provider value={ctx}>
      <div className={cn("flex flex-col", className)}>
        <Label hint={hint} htmlFor={id}>
          {label}
        </Label>
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export function Slider({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={cn("w-full accent-[var(--accent)] h-1.5 cursor-pointer", className)} {...props} />;
}

export function Switch({ checked, onChange, label, className, ariaLabel, title }: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string; ariaLabel?: string; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (label ? undefined : title)}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex items-center gap-2 text-sm text-fg-muted cursor-pointer", className)}
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-accent" : "bg-line-strong")}>
        <span className={cn("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

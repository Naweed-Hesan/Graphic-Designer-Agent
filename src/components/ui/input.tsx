"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-line bg-bg-inset px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, "h-9", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "py-2 min-h-[80px] leading-relaxed resize-y", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(base, "h-9 pr-8 appearance-none bg-no-repeat bg-[right_8px_center]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }}
      {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, children, hint, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn("flex items-baseline justify-between gap-2 text-[13px] font-medium text-fg-muted mb-1.5", className)} {...props}>
      <span>{children}</span>
      {hint ? <span className="text-[11px] font-normal text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

export function Field({ label, hint, children, className }: { label: React.ReactNode; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

export function Slider({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={cn("w-full accent-[var(--accent)] h-1.5 cursor-pointer", className)} {...props} />;
}

export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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

"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { ColorRole, type Genome, type Palette } from "@/lib/genome/schema";
import { normalizeHex } from "@/lib/color/convert";
import { cn, debounce } from "@/lib/utils";

export const ROLES: ColorRole[] = ColorRole.options;

export const ROLE_LABEL: Record<ColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  neutral: "Neutral",
  background: "Background",
  surface: "Surface",
  text: "Text",
  success: "Success",
  warning: "Warning",
  error: "Error",
  custom: "Custom",
};

export const ROLE_TONE: Record<ColorRole, "neutral" | "accent" | "success" | "warning" | "danger" | "info"> = {
  primary: "accent",
  secondary: "info",
  accent: "warning",
  neutral: "neutral",
  background: "neutral",
  surface: "neutral",
  text: "neutral",
  success: "success",
  warning: "warning",
  error: "danger",
  custom: "neutral",
};

const commitSummary = debounce((summary: string) => useProject.getState().update(() => {}, { summary, stage: "color" }), 600);

/**
 * Edit the palette through the store. With `debounced`, the change is applied
 * immediately but the history entry is written once the burst settles, so a
 * picker drag produces one summary rather than hundreds.
 */
export function editPalette(fn: (palette: Palette, genome: Genome) => void, summary?: string, debounced = false) {
  const update = useProject.getState().update;
  if (summary && !debounced) {
    update((g) => {
      fn(g.visual.palette, g);
    }, { summary, stage: "color" });
    return;
  }
  update((g) => {
    fn(g.visual.palette, g);
  });
  if (summary) commitSummary(summary);
}

export async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Clipboard is not available in this browser");
  }
}

export function CopyButton({ text, label, className, children }: { text: string; label?: string; className?: string; children?: React.ReactNode }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size={children ? "sm" : "icon-sm"}
      className={className}
      title={label ?? `Copy ${text}`}
      aria-label={label ?? `Copy ${text}`}
      onClick={async () => {
        await copyText(text, label ? `${label} copied` : `Copied ${text}`);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {children}
    </Button>
  );
}

export const hexInputClass =
  "w-full h-8 rounded-md border border-line bg-bg-inset px-2.5 font-mono text-[13px] uppercase text-fg placeholder:text-fg-subtle transition-colors focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Hex text input that tolerates partial typing and only emits valid colours. */
export function HexField({ value, onChange, className, id, ariaLabel }: { value: string; onChange: (hex: string) => void; className?: string; id?: string; ariaLabel?: string }) {
  return (
    <HexColorInput
      id={id}
      prefixed
      color={value}
      onChange={(v) => {
        const hex = normalizeHex(v);
        if (hex) onChange(hex);
      }}
      className={cn(hexInputClass, className)}
      aria-label={ariaLabel ?? "Hex colour"}
      spellCheck={false}
    />
  );
}

/** Close a floating panel on outside pointer-down or Escape. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [ref, open, onClose]);
}

/** A compact colour well that opens a picker popover. */
export function ColorWell({ value, onChange, label, align = "left", className }: { value: string; onChange: (hex: string) => void; label: string; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-8 rounded-md border border-line-strong shadow-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
        style={{ background: value }}
        title={`${label}: ${value.toUpperCase()}`}
        aria-label={label}
        aria-expanded={open}
      />
      {open && (
        <div className={cn("absolute top-full z-40 mt-1.5 w-56 surface p-3 shadow-card animate-in", align === "right" ? "right-0" : "left-0")}>
          <HexColorPicker color={value} onChange={(v) => onChange(v.toLowerCase())} style={{ width: "100%", height: 150 }} />
          <HexField value={value} onChange={onChange} className="mt-2" ariaLabel={`${label} hex`} />
        </div>
      )}
    </div>
  );
}

/**
 * Render into document.body. The studio's stage wrapper keeps a transform after
 * its entrance animation, which would otherwise turn `position: fixed` dialogs
 * into children of the scrolling column.
 */
export function BodyPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

/** Format a share/ratio as a compact percentage. */
export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

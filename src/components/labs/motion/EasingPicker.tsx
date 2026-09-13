"use client";
import * as React from "react";
import { Input, Select } from "@/components/ui";
import { BRAND_EASING_ID, EASING_PRESETS, easeFromCss, easingToPath, isValidEasingCss, resolveEasingCss } from "@/lib/motion/easing";
import { cn } from "@/lib/utils";

/** Tiny curve preview of a CSS timing function. */
export function EasingCurve({ css, className }: { css: string; className?: string }) {
  const d = React.useMemo(() => easingToPath(easeFromCss(css), 64, 40), [css]);
  return (
    <svg viewBox="-3 -14 70 68" className={cn("h-10 w-16 shrink-0", className)} aria-hidden="true">
      <rect x="0" y="0" width="64" height="40" rx="3" className="fill-bg-inset stroke-line" />
      <line x1="0" y1="40" x2="64" y2="0" className="stroke-line" strokeDasharray="2 3" />
      <path d={d} fill="none" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface EasingPickerProps {
  /** Easing preset id or "custom" */
  id: string;
  custom: string;
  onChange: (id: string, custom: string) => void;
  /** Resolves the "Brand default" entry */
  brandCss?: string;
  hideBrand?: boolean;
}

export function EasingPicker({ id, custom, onChange, brandCss = "", hideBrand }: EasingPickerProps) {
  const css = id === "custom" ? custom : resolveEasingCss(id, brandCss);
  const valid = id !== "custom" || isValidEasingCss(custom);
  const preset = EASING_PRESETS.find((p) => p.id === id);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={id}
          aria-label="Easing"
          onChange={(e) => {
            const next = e.target.value;
            onChange(next, next === "custom" && !custom ? css : custom);
          }}
        >
          {EASING_PRESETS.filter((p) => !hideBrand || p.id !== BRAND_EASING_ID).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom">Custom cubic-bezier…</option>
        </Select>
        <EasingCurve css={valid ? css : "linear"} />
      </div>
      {id === "custom" ? (
        <Input
          value={custom}
          onChange={(e) => onChange("custom", e.target.value)}
          placeholder="cubic-bezier(0.2, 0.8, 0.2, 1)"
          aria-label="Custom easing"
          spellCheck={false}
          className={cn("font-mono text-xs", !valid && "border-danger focus:border-danger")}
        />
      ) : null}
      <p className="text-[11px] text-fg-subtle leading-snug break-all">
        {id === "custom" ? (valid ? css : "Use cubic-bezier(x1, y1, x2, y2) with x in 0–1, a keyword (ease-out…), or steps(n).") : `${preset?.description ?? ""} · ${css}`}
      </p>
    </div>
  );
}

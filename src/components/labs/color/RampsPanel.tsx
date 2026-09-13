"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { BrandColor } from "@/lib/genome/schema";
import { bestTextOn } from "@/lib/color/contrast";
import { ramp, rampCss } from "@/lib/color/ramps";
import { cn, uid } from "@/lib/utils";
import { CopyButton, copyText, editPalette } from "./shared";

export function RampsPanel({ colors }: { colors: BrandColor[] }) {
  const existing = new Set(colors.map((c) => c.hex.toLowerCase()));
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-fg-muted -mt-1">
        Eleven steps at fixed OKLCH lightness targets; hue is kept and chroma tapers toward the ends. Click a step to copy its hex, or add it to the palette.
      </p>
      {colors.map((c) => {
        const steps = ramp(c.hex);
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-4 w-4 rounded border border-black/10" style={{ background: c.hex }} />
                <span className="font-medium">{c.name}</span>
                <span className="font-mono text-[11px] text-fg-subtle uppercase">{c.hex}</span>
              </div>
              <CopyButton text={rampCss(c.name, c.hex)} label={`${c.name} ramp CSS`}>
                Copy CSS
              </CopyButton>
            </div>
            <div className="flex gap-1">
              {steps.map((s) => {
                const fg = bestTextOn(s.hex);
                const inPalette = existing.has(s.hex.toLowerCase());
                return (
                  <div key={s.step} className="group relative flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => copyText(s.hex.toUpperCase(), `Copied ${c.name} ${s.step} · ${s.hex.toUpperCase()}`)}
                      className={cn("w-full h-11 rounded-md border border-black/10 flex flex-col items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-ring", s.isSeed && "ring-2 ring-accent ring-offset-1 ring-offset-bg-elev")}
                      style={{ background: s.hex, color: fg }}
                      title={`${c.name} ${s.step} · ${s.hex.toUpperCase()} — click to copy`}
                      aria-label={`Copy ${c.name} ${s.step} ${s.hex}`}
                    >
                      <span className="text-[10px] font-mono leading-none opacity-90">{s.step}</span>
                      <span className="text-[9px] font-mono leading-none opacity-0 group-hover:opacity-80 mt-1 uppercase">{s.hex.slice(1)}</span>
                    </button>
                    {!s.isSeed && !inPalette ? (
                      <button
                        type="button"
                        onClick={() => {
                          const name = `${c.name} ${s.step}`;
                          editPalette((p) => {
                            p.colors.push({ id: uid(6), name, hex: s.hex, role: "custom", usage: `${s.step < 500 ? "Tint" : "Shade"} of ${c.name}`, locked: false });
                          }, `Added ${name} to palette`);
                          toast.success(`${name} added to the palette`);
                        }}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-bg-elev border border-line text-fg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-fg hover:border-line-strong flex items-center justify-center cursor-pointer shadow-sm"
                        title={`Add ${c.name} ${s.step} to palette`}
                        aria-label={`Add ${c.name} ${s.step} to palette`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

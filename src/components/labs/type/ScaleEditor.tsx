"use client";
import * as React from "react";
import { NumberInput } from "@/components/ui/number-input";
import { Field, Select, Switch } from "@/components/ui";
import type { Typography } from "@/lib/genome/schema";
import { fluidScale, RATIOS, ratioFor } from "@/lib/type/scale";
import { fontStack } from "@/lib/type/fonts";
import { cn } from "@/lib/utils";
import { Section } from "./shared";
import type { GenomeEdit } from "./hooks";

const MAX_PREVIEW_PX = 220;
const MIN_VW = 360;
const MAX_VW = 1440;

export function ScaleEditor({ typography, brand, edit }: { typography: Typography; brand: string; edit: GenomeEdit }) {
  const { base, ratio } = typography.scale;
  const [customMode, setCustomMode] = React.useState(false);
  const [fluid, setFluid] = React.useState(false);
  const named = ratioFor(ratio);
  const isCustom = customMode || !named;
  const steps = React.useMemo(() => fluidScale({ base, ratio, minVw: MIN_VW, maxVw: MAX_VW }), [base, ratio]);

  const setRatio = (value: number, label: string) => edit((g) => void (g.visual.typography.scale.ratio = value), `Type ratio → ${label}`);

  return (
    <Section
      id="type-scale"
      title="Type scale"
      description="A modular scale from one base size and one ratio. Steps above the base are set in the display face, the base and below in the body face."
      actions={<Switch checked={fluid} onChange={setFluid} label={`Fluid (${MIN_VW}–${MAX_VW}px)`} />}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Field label="Base size" hint="px">
          <NumberInput
            min={8}
            max={40}
            step={1}
            value={base}
            onCommit={(v) => edit((g) => void (g.visual.typography.scale.base = v), `Type base size → ${v}px`, { debounce: true })}
            aria-label="Base size in pixels"
          />
        </Field>
        <Field label="Ratio" hint={named?.note ?? "custom ratio"} className="col-span-1 md:col-span-2">
          <Select
            aria-label="Scale ratio"
            value={isCustom ? "custom" : named!.id}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "custom") {
                setCustomMode(true);
                return;
              }
              const r = RATIOS.find((x) => x.id === id);
              if (!r) return;
              setCustomMode(false);
              setRatio(r.value, `${r.name} (${r.value})`);
            }}
          >
            {RATIOS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.value}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </Select>
        </Field>
        {isCustom && (
          <Field label="Custom ratio" hint="1.05–2">
            <NumberInput
              min={1.05}
              max={2.5}
              step={0.01}
              value={ratio}
              aria-label="Custom ratio"
              onCommit={(v) => edit((g) => void (g.visual.typography.scale.ratio = Math.round(v * 1000) / 1000), `Type ratio → ${Math.round(v * 1000) / 1000}`, { debounce: true })}
            />
          </Field>
        )}
      </div>

      <div className="inset overflow-hidden divide-y divide-line">
        {[...steps].reverse().map((s) => {
          const useDisplay = s.exp > 0;
          const font = useDisplay ? typography.display : typography.body;
          const capped = !fluid && s.px > MAX_PREVIEW_PX;
          const fontSize = fluid ? s.clamp : `${Math.min(s.px, MAX_PREVIEW_PX)}px`;
          return (
            <div key={s.name} className="flex items-center gap-4 px-4 py-2 min-w-0">
              <div className="w-28 shrink-0 text-[11px] leading-4 text-fg-subtle font-mono">
                <div className="text-fg font-semibold text-xs">{s.name}</div>
                {fluid ? (
                  <div title={s.clamp}>
                    {Math.round(s.minPx)}→{Math.round(s.maxPx)}px
                  </div>
                ) : (
                  <div>
                    {s.px}px · {s.rem}rem
                  </div>
                )}
                {capped && <div className="text-warning">shown at {MAX_PREVIEW_PX}px</div>}
              </div>
              <div
                className={cn("flex-1 min-w-0 truncate", useDisplay ? "text-fg" : "text-fg-muted")}
                style={{ fontFamily: fontStack(font.family, font.fallback), fontSize, lineHeight: 1.05, fontWeight: useDisplay ? Math.max(...font.weights, 400) : 400 }}
                title={`${s.name} · ${font.family}`}
              >
                {brand}
              </div>
              {fluid ? <code className="hidden lg:block shrink-0 text-[10px] text-fg-subtle font-mono max-w-[260px] truncate">{s.clamp}</code> : null}
            </div>
          );
        })}
      </div>
      {fluid && <p className="text-[11px] text-fg-subtle mt-2">Preview text is set with the clamp() value, so resize the window to see it flex. The base size stays fixed; the ratio softens to {Math.round((1 + (ratio - 1) * 0.7) * 1000) / 1000} at {MIN_VW}px.</p>}
    </Section>
  );
}

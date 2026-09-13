"use client";
import * as React from "react";
import { Check, Copy, Download, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Chips, Field, Select, Slider, Textarea } from "@/components/ui";
import type { Genome, MotionSystem } from "@/lib/genome/schema";
import { useProject } from "@/lib/store/project";
import { BRAND_EASING_ID, EASING_PRESETS, isValidEasingCss } from "@/lib/motion/easing";
import { MOTION_PRESETS, getPreset } from "@/lib/motion/presets";
import { PRINCIPLE_SUGGESTIONS, motionTokensCss } from "@/lib/motion/tokens";
import { debounce, downloadBlob, slugify } from "@/lib/utils";
import { EasingPicker } from "./EasingPicker";
import type { LogoAnimSettings } from "./shared";

export function PrinciplesTab({ genome, settings, onOpenLogo }: { genome: Genome; settings: LogoAnimSettings; onOpenLogo: () => void }) {
  const update = useProject((s) => s.update);
  const m = genome.visual.motion;
  const preset = getPreset(m.preset);

  const setMotion = React.useCallback(
    (fn: (motion: MotionSystem) => void, summary: string) => update((g) => void fn(g.visual.motion), { summary, stage: "motion" }),
    [update],
  );

  // Easing: show the matching preset, otherwise "custom" with the raw css.
  const matched = EASING_PRESETS.find((p) => p.id !== BRAND_EASING_ID && p.css === m.easing)?.id;
  const [easingId, setEasingId] = React.useState(matched ?? "custom");
  const [custom, setCustom] = React.useState(m.easing);

  // Base duration: local state for a smooth slider, debounced write to the Genome.
  const [base, setBase] = React.useState(m.durationBase);
  const saveBase = React.useMemo(() => debounce((v: number) => setMotion((mm) => void (mm.durationBase = v), `Motion base duration → ${v} ms`), 300), [setMotion]);

  const [notes, setNotes] = React.useState(m.notes);
  const saveNotes = React.useMemo(() => debounce((v: string) => setMotion((mm) => void (mm.notes = v), "Motion notes updated"), 600), [setMotion]);

  const tokens = React.useMemo(() => motionTokensCss(genome, preset, { duration: settings.duration }), [genome, preset, settings.duration]);
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tokens);
      setCopied(true);
      toast.success("Motion tokens copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable — use Download instead");
    }
  };

  const suggestions = PRINCIPLE_SUGGESTIONS.filter((s) => !m.principles.includes(s));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 min-w-0">
        <section className="surface p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Timing</h2>
            <p className="text-xs text-fg-muted mt-0.5">The easing and base duration every animation in the system derives from. Presets in the Logo tab default to multiples of the base.</p>
          </div>
          <Field label="Brand easing" hint={m.easing}>
            <EasingPicker
              id={easingId}
              custom={custom}
              hideBrand
              onChange={(id, css) => {
                setEasingId(id);
                setCustom(css);
                const next = id === "custom" ? css : (EASING_PRESETS.find((p) => p.id === id)?.css ?? css);
                if (isValidEasingCss(next) && next !== m.easing) setMotion((mm) => void (mm.easing = next), `Motion easing → ${next}`);
              }}
            />
          </Field>
          <Field label="Base duration" hint={`${base} ms`}>
            <Slider
              min={100}
              max={1500}
              step={10}
              value={base}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBase(v);
                saveBase(v);
              }}
              aria-label="Base duration in milliseconds"
              data-testid="duration-base"
            />
            <div className="flex justify-between text-[10px] text-fg-subtle font-mono mt-1">
              <span>instant {Math.round(base * 0.25)}</span>
              <span>fast {Math.round(base * 0.5)}</span>
              <span>base {base}</span>
              <span>slow {Math.round(base * 1.5)}</span>
            </div>
          </Field>
        </section>

        <section className="surface p-5 flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">Principles</h2>
            <p className="text-xs text-fg-muted mt-0.5">Short rules a motion designer can hold in their head. They also steer the AI video prompt.</p>
          </div>
          <Chips value={m.principles} onChange={(principles) => setMotion((mm) => void (mm.principles = principles), "Motion principles updated")} placeholder="Add a principle and press Enter" />
          {suggestions.length ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => setMotion((mm) => void (mm.principles = [...mm.principles, s]), `Motion principle: ${s}`)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[12px] text-fg-muted hover:text-fg hover:border-line-strong cursor-pointer">
                  <Plus className="h-3 w-3" /> {s}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="surface p-5 flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">Signature preset</h2>
            <p className="text-xs text-fg-muted mt-0.5">The logo reveal used in guidelines and exports.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={preset.id} onChange={(e) => setMotion((mm) => void (mm.preset = e.target.value), `Motion preset → ${getPreset(e.target.value).name}`)} aria-label="Signature preset" data-testid="preset-select">
              {MOTION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="md" onClick={onOpenLogo} title="Preview in the Logo animation tab">
              <ExternalLink className="h-3.5 w-3.5" /> Preview
            </Button>
          </div>
          <p className="text-xs text-fg-muted">
            {preset.description} <span className="text-fg-subtle">· {preset.tags.join(", ")}</span>
          </p>
        </section>

        <section className="surface p-5 flex flex-col gap-3">
          <Field label="Notes" hint="rationale, exceptions, hand-off details">
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                saveNotes(e.target.value);
              }}
              placeholder="e.g. Reveal only on first load; subsequent navigations cut. Reduced-motion users get a plain fade."
              className="min-h-[110px]"
            />
          </Field>
        </section>
      </div>

      <section className="surface p-5 flex flex-col gap-3 min-w-0 self-start lg:sticky lg:top-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Motion tokens</h2>
            <p className="text-xs text-fg-muted mt-0.5">CSS custom properties plus a keyframes translation of {preset.name}. Kept in sync with the Genome.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="secondary" onClick={copy} title="Copy to clipboard" data-testid="copy-tokens">
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([tokens], { type: "text/css" }), `${slugify(genome.name)}-motion.css`)} title="Download .css">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <pre className="inset p-3 text-[11.5px] font-mono leading-relaxed overflow-auto max-h-[560px] whitespace-pre" data-testid="motion-tokens">
          <code>{tokens}</code>
        </pre>
      </section>
    </div>
  );
}

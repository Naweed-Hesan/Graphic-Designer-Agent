"use client";
import * as React from "react";
import { Copy, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chips, EmptyState, Field, Input, SectionHeader, Select, Switch, Textarea } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { ImageryStyle } from "@/lib/genome/schema";
import { aspectToSize, compilePrompt, type ImagePurpose } from "@/lib/imagery/prompt-compiler";
import { PURPOSES, STYLE_STARTERS, STYLE_VOCAB, type StyleStarter, imageryStyleIsEmpty, sampleSubjectFor } from "@/lib/imagery/presets";
import { PromptNotes, ReferenceStrip, SuggestionChips } from "./shared";

type TextKey = "medium" | "lighting" | "composition" | "colorTreatment" | "subjects" | "promptSuffix" | "guidance";
type ListKey = "mood" | "avoid";

const LABELS: Record<TextKey | ListKey, string> = {
  medium: "medium",
  lighting: "lighting",
  composition: "composition",
  colorTreatment: "colour treatment",
  subjects: "subjects",
  promptSuffix: "prompt suffix",
  guidance: "guidance",
  mood: "mood",
  avoid: "avoid list",
};

/**
 * Text fields write straight to the Genome (so the compiled preview and the
 * Director always see the live value) while the history entry is debounced
 * into one line per editing burst.
 */
function useHistorySummary(delay = 700) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<string[]>([]);
  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const labels = pending.current;
    pending.current = [];
    if (!labels.length) return;
    useProject.getState().update(() => undefined, { summary: `Imagery style: ${labels.join(", ")}`, stage: "imagery" });
  }, []);
  const note = React.useCallback(
    (label: string) => {
      if (!pending.current.includes(label)) pending.current.push(label);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );
  React.useEffect(() => flush, [flush]);
  return note;
}

function splitPhrases(value: string): string[] {
  return value
    .split(/\s*[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasPhrase(value: string, phrase: string): boolean {
  const p = phrase.toLowerCase();
  return splitPhrases(value).some((x) => x.toLowerCase() === p);
}

function togglePhrase(value: string, phrase: string): string {
  const parts = splitPhrases(value);
  const i = parts.findIndex((x) => x.toLowerCase() === phrase.toLowerCase());
  if (i >= 0) parts.splice(i, 1);
  else parts.push(phrase);
  return parts.join(", ");
}

function StyleField({
  label,
  hint,
  value,
  onChange,
  suggestions,
  placeholder,
  textarea,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      {textarea ? (
        <Textarea rows={2} className="min-h-[60px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      <SuggestionChips className="mt-1.5" items={suggestions} isActive={(s) => hasPhrase(value, s)} onPick={(s) => onChange(togglePhrase(value, s))} />
    </Field>
  );
}

export function StyleTab() {
  const genome = useProject((s) => s.genome);
  const update = useProject((s) => s.update);
  const note = useHistorySummary();
  const [previewPurpose, setPreviewPurpose] = React.useState<ImagePurpose>("hero");
  const [subjectDraft, setSubjectDraft] = React.useState<string | null>(null);
  const [includeHex, setIncludeHex] = React.useState(true);
  if (!genome) return null;

  const style: ImageryStyle = genome.visual.imagery;
  const empty = imageryStyleIsEmpty(style);

  const setText = (key: TextKey, value: string) => {
    update((g) => {
      g.visual.imagery[key] = value;
    });
    note(LABELS[key]);
  };
  const setList = (key: ListKey, value: string[]) =>
    update(
      (g) => {
        g.visual.imagery[key] = value;
      },
      { summary: `Imagery style: ${LABELS[key]} updated`, stage: "imagery" },
    );
  const applyStarter = (s: StyleStarter) =>
    update(
      (g) => {
        Object.assign(g.visual.imagery, structuredClone(s.style));
      },
      { summary: `Imagery style: applied “${s.label}” starter`, stage: "imagery" },
    );
  const clearAll = () => {
    if (!confirm("Clear every imagery style field? Style references are kept.")) return;
    update(
      (g) => {
        const referenceAssetIds = g.visual.imagery.referenceAssetIds;
        g.visual.imagery = { medium: "", lighting: "", composition: "", colorTreatment: "", subjects: "", mood: [], avoid: [], promptSuffix: "", referenceAssetIds, guidance: "" };
      },
      { summary: "Imagery style cleared", stage: "imagery" },
    );
  };

  const subject = subjectDraft ?? sampleSubjectFor(previewPurpose);
  const compiled = compilePrompt({ genome, subject, purpose: previewPurpose, includeHex });
  const size = aspectToSize(compiled.aspectHint);
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(compiled.prompt);
      toast.success("Compiled prompt copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="@container flex flex-col gap-5">
      {empty && (
        <EmptyState
          icon={<Sparkles className="h-7 w-7" />}
          title="No imagery style yet"
          description="Pick a starter, fill the fields below, or ask the Creative Director to derive a style from the strategy. Every field is compiled into every prompt."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {STYLE_STARTERS.map((s) => (
                <Button key={s.id} variant="secondary" size="sm" onClick={() => applyStarter(s)} title={s.description}>
                  {s.label}
                </Button>
              ))}
            </div>
          }
        />
      )}

      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <Card className="@container flex flex-col gap-5">
          <SectionHeader
            title="Imagery style"
            description="Short phrases work best — they are joined into one sentence and injected into every photographic or illustrative prompt."
            className="mb-0"
            actions={
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={empty} title="Clear all fields">
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </Button>
            }
          />
          <StyleField label="Medium" hint="how it is made" value={style.medium} onChange={(v) => setText("medium", v)} suggestions={STYLE_VOCAB.medium} placeholder="Editorial photography with a matte film look" />
          <StyleField label="Lighting" value={style.lighting} onChange={(v) => setText("lighting", v)} suggestions={STYLE_VOCAB.lighting} placeholder="Low winter sun, long shadows" />
          <StyleField label="Composition" value={style.composition} onChange={(v) => setText("composition", v)} suggestions={STYLE_VOCAB.composition} placeholder="Generous negative space, subject low in frame" />
          <StyleField label="Colour treatment" value={style.colorTreatment} onChange={(v) => setText("colorTreatment", v)} suggestions={STYLE_VOCAB.colorTreatment} placeholder="Cool shadows, warm highlights, muted saturation" />
          <StyleField
            label="Recurring subjects"
            hint="what the brand photographs — guidance for people and the Director"
            value={style.subjects}
            onChange={(v) => setText("subjects", v)}
            suggestions={STYLE_VOCAB.subjects}
            placeholder="Steam, hands, ceramic, volcanic rock"
            textarea
          />
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Mood" hint="injected as “mood: …”">
              <Chips value={style.mood} onChange={(v) => setList("mood", v)} placeholder="Add a mood word…" />
              <SuggestionChips className="mt-1.5" items={STYLE_VOCAB.mood} isActive={(s) => style.mood.includes(s)} onPick={(s) => setList("mood", style.mood.includes(s) ? style.mood.filter((x) => x !== s) : [...style.mood, s])} />
            </Field>
            <Field label="Avoid" hint="negative prompt, or “Avoid: …” when unsupported">
              <Chips value={style.avoid} onChange={(v) => setList("avoid", v)} placeholder="Add something to avoid…" />
              <SuggestionChips className="mt-1.5" items={STYLE_VOCAB.avoid} isActive={(s) => style.avoid.includes(s)} onPick={(s) => setList("avoid", style.avoid.includes(s) ? style.avoid.filter((x) => x !== s) : [...style.avoid, s])} />
            </Field>
          </div>
          <Field label="Prompt suffix" hint="appended verbatim to every prompt">
            <Input value={style.promptSuffix} onChange={(e) => setText("promptSuffix", e.target.value)} placeholder="e.g. shot on medium format, 50mm, f/4" className="font-mono text-[13px]" />
          </Field>
          <Field label="Art direction guidance" hint="for people and the Creative Director — never sent to image models">
            <Textarea rows={3} value={style.guidance} onChange={(e) => setText("guidance", e.target.value)} placeholder="Show the place before the product. Coffee appears as ritual, never as a pile of beans." />
          </Field>
        </Card>

        <div className="flex flex-col gap-5 @4xl:sticky @4xl:top-6">
          <Card className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="label">Compiled prompt preview</div>
                <p className="text-xs text-fg-muted mt-0.5">Exactly what a model receives — the Genome is compiled into every request.</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={copyPrompt} title="Copy compiled prompt">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Purpose">
                <Select value={previewPurpose} onChange={(e) => setPreviewPurpose(e.target.value as ImagePurpose)}>
                  {PURPOSES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sample subject">
                <Input value={subject} onChange={(e) => setSubjectDraft(e.target.value)} />
              </Field>
            </div>
            <div className="inset p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words" data-testid="compiled-prompt">
              {compiled.prompt}
            </div>
            <PromptNotes notes={compiled.notes} aspect={compiled.aspectHint} />
            <div>
              <div className="label mb-1">Negative prompt</div>
              <div className="text-xs text-fg-muted font-mono break-words">{compiled.negativePrompt || "—"}</div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-line">
              <Switch checked={includeHex} onChange={setIncludeHex} label="Include palette hex codes" />
              <span className="text-xs text-fg-subtle font-mono">
                {size.width}×{size.height}
              </span>
            </div>
          </Card>
          <ReferenceStrip />
        </div>
      </div>
    </div>
  );
}

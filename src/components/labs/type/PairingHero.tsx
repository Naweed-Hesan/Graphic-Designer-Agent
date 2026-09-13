"use client";
import * as React from "react";
import { ArrowLeftRight, Pencil } from "lucide-react";
import { Badge, Button, Textarea } from "@/components/ui";
import type { FontSpec, Typography } from "@/lib/genome/schema";
import type { FontMeta } from "@/app/api/fonts/route";
import { findFont, hasArabic } from "@/lib/type/fontmeta";
import { cn } from "@/lib/utils";
import { CategoryBadge, Eyebrow, FontText, Section, SLOT_LABEL, type Slot } from "./shared";

const SAMPLE: Record<Slot, string> = {
  display: "Sphinx of black quartz, judge my vow",
  body: "The quick brown fox jumps over the lazy dog. 0123456789",
  mono: "const brand = { type: 'system' }; // 0O1lI",
};

function SlotCard({ slot, spec, meta, onChange, large }: { slot: Slot; spec: FontSpec; meta?: FontMeta; onChange: () => void; large?: boolean }) {
  const heaviest = Math.max(...spec.weights, 400);
  return (
    <div className={cn("surface-2 p-4 flex flex-col gap-3 min-w-0", large && "@xl:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{SLOT_LABEL[slot]}</Eyebrow>
        <Button variant="ghost" size="sm" onClick={onChange} aria-label={`Change ${slot} font`} title={`Change ${slot} font`}>
          <Pencil className="h-3.5 w-3.5" /> Change
        </Button>
      </div>
      <FontText family={spec.family} weights={spec.weights} fallback={spec.fallback} className={cn("truncate leading-none tracking-tight", large ? "text-[40px] @4xl:text-[44px]" : "text-[26px] @4xl:text-[30px]")} style={{ fontWeight: slot === "display" ? heaviest : 400 }}>
        {spec.family}
      </FontText>
      <FontText family={spec.family} weights={spec.weights} fallback={spec.fallback} className={cn("text-fg-muted truncate", large ? "text-[15px]" : "text-[13px]")} style={{ fontWeight: 400 }}>
        {SAMPLE[slot]}
      </FontText>
      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
        <CategoryBadge category={spec.category} />
        {spec.variable && <Badge tone="info">variable</Badge>}
        {hasArabic(meta) && <Badge tone="success">Arabic</Badge>}
        {spec.source !== "google" && <Badge>{spec.source}</Badge>}
        <span className="text-[11px] text-fg-subtle ml-auto font-mono">{[...spec.weights].sort((a, b) => a - b).join(" · ")}</span>
      </div>
    </div>
  );
}

function RationaleField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  return (
    <Textarea
      id="type-rationale"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value.trim() && onCommit(draft.trim())}
      placeholder="Why this pairing works for the brand — tone, contrast, where each face is used…"
      className="min-h-[64px]"
    />
  );
}

export function PairingHero({ typography, fonts, onChange, onSwap, onRationale }: { typography: Typography; fonts: FontMeta[]; onChange: (slot: Slot) => void; onSwap: () => void; onRationale: (v: string) => void }) {
  return (
    <Section
      id="type-pairing"
      title="Current pairing"
      description="Display carries headlines and the wordmark; body does the reading; mono is for code, data and labels."
      actions={
        <Button variant="secondary" size="sm" onClick={onSwap} title="Swap display and body fonts">
          <ArrowLeftRight className="h-3.5 w-3.5" /> Swap display ↔ body
        </Button>
      }
    >
      <div className="@container"><div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-4 gap-3">
        <SlotCard slot="display" spec={typography.display} meta={findFont(fonts, typography.display.family) as FontMeta | undefined} onChange={() => onChange("display")} large />
        <SlotCard slot="body" spec={typography.body} meta={findFont(fonts, typography.body.family) as FontMeta | undefined} onChange={() => onChange("body")} />
        <SlotCard slot="mono" spec={typography.mono} meta={findFont(fonts, typography.mono.family) as FontMeta | undefined} onChange={() => onChange("mono")} />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="type-rationale" className="label mb-1.5 block">
          Rationale
        </label>
        <RationaleField key={typography.rationale} value={typography.rationale} onCommit={onRationale} />
      </div>
    </Section>
  );
}

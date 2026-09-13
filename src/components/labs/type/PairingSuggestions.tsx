"use client";
import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { Badge, Button, Switch, Tabs } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import type { FontMeta } from "@/app/api/fonts/route";
import { pairFor, suggestPairings, type PairSuggestion } from "@/lib/type/pairing";
import { PANGRAMS } from "@/lib/type/specimen";
import { fallbackFor, findFont, hasArabic, toCategory } from "@/lib/type/fontmeta";
import { cn } from "@/lib/utils";
import { CategoryBadge, FontText, Section } from "./shared";

export type SuggestMode = "brand" | "display";

function PairCard({ pair, current, onUse }: { pair: PairSuggestion; current: boolean; onUse: () => void }) {
  return (
    <div className={cn("surface-2 p-4 flex flex-col gap-3 min-w-0", current && "border-accent")}>
      <div className="min-w-0">
        <FontText family={pair.display} weights={[400, 700]} fallback={fallbackFor(toCategory(pair.displayCategory))} className="text-[26px] leading-tight truncate" style={{ fontWeight: pair.displayCategory === "sans-serif" ? 700 : 400 }}>
          {pair.display}
        </FontText>
        <FontText family={pair.body} weights={[400]} fallback={fallbackFor(toCategory(pair.bodyCategory))} className="text-[13px] text-fg-muted leading-snug mt-1 line-clamp-2">
          {pair.body} — {PANGRAMS[1]}
        </FontText>
      </div>
      <p className="text-xs text-fg-muted leading-relaxed">{pair.rationale}</p>
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-fg-subtle">
        <CategoryBadge category={pair.displayCategory} />
        <span>+</span>
        <CategoryBadge category={pair.bodyCategory} />
        {pair.reasons.slice(0, 3).map((r) => (
          <span key={r} className="rounded-full bg-bg-inset border border-line px-1.5 py-0.5">
            {r}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        {current ? (
          <Badge tone="accent">
            <Check className="h-3 w-3" /> current
          </Badge>
        ) : (
          <span />
        )}
        <Button variant={current ? "secondary" : "primary"} size="sm" onClick={onUse} disabled={current}>
          Use pair
        </Button>
      </div>
    </div>
  );
}

export function PairingSuggestions({ genome, fonts, mode, onMode, onUsePair }: { genome: Genome; fonts: FontMeta[]; mode: SuggestMode; onMode: (m: SuggestMode) => void; onUsePair: (display: string, body: string) => void }) {
  const t = genome.visual.typography;
  const brandArabic = hasArabic(findFont(fonts, t.display.family)) || hasArabic(findFont(fonts, t.body.family));
  const [arabic, setArabic] = React.useState(brandArabic);
  const { strategy } = genome;

  const pairs = React.useMemo(() => {
    if (mode === "display") return pairFor(t.display.family, fonts, { personality: strategy.personality });
    return suggestPairings({ fonts, personality: strategy.personality, archetype: strategy.archetype, secondaryArchetype: strategy.secondaryArchetype, arabic });
  }, [mode, t.display.family, fonts, strategy.personality, strategy.archetype, strategy.secondaryArchetype, arabic]);

  const personalitySummary = strategy.personality
    .filter((a) => Math.abs(a.value - 50) >= 15)
    .map((a) => (a.value > 50 ? a.right : a.left).toLowerCase())
    .join(", ");

  return (
    <Section
      id="type-pairings"
      title="Pairing suggestions"
      description={
        mode === "brand"
          ? `Scored against the personality sliders${personalitySummary ? ` (${personalitySummary})` : ""}${strategy.archetype ? ` and the ${strategy.archetype} archetype` : ""}.`
          : `Body faces that sit well under ${t.display.family}. Curated partners first, then reliable text faces that contrast with its ${t.display.category} shapes.`
      }
      actions={
        <div className="flex items-center gap-3">
          {mode === "brand" && <Switch checked={arabic} onChange={setArabic} label="Needs Arabic" />}
          <Tabs
            value={mode}
            onChange={onMode}
            items={[
              { value: "brand", label: "For this brand", icon: <Sparkles className="h-3.5 w-3.5" /> },
              { value: "display", label: `For ${t.display.family}` },
            ]}
          />
        </div>
      }
    >
      {pairs.length === 0 ? (
        <div className="text-sm text-fg-muted">No suggestions available — the font catalogue is empty.</div>
      ) : (
        <div className="@container"><div className="grid grid-cols-1 @xl:grid-cols-2 @5xl:grid-cols-4 gap-3">
          {pairs.map((p) => (
            <PairCard key={`${p.display}+${p.body}`} pair={p} current={p.display === t.display.family && p.body === t.body.family} onUse={() => onUsePair(p.display, p.body)} />
          ))}
          </div>
        </div>
      )}
    </Section>
  );
}

"use client";
import * as React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge, Card, Field, SectionHeader, Textarea } from "@/components/ui";
import type { BrandColor } from "@/lib/genome/schema";
import { analyzePalette, paletteStats } from "@/lib/color/palette-analysis";
import { editPalette } from "./shared";

const ICON = {
  ok: <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" aria-label="OK" />,
  warn: <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" aria-label="Warning" />,
  error: <XCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" aria-label="Problem" />,
};

export function AnalysisCard({ colors, rationale }: { colors: BrandColor[]; rationale: string }) {
  const insights = React.useMemo(() => analyzePalette(colors), [colors]);
  const stats = React.useMemo(() => paletteStats(colors), [colors]);
  const problems = insights.filter((i) => i.level !== "ok").length;
  return (
    <Card className="self-start">
      <SectionHeader title="Analysis" description={problems ? `${problems} thing${problems > 1 ? "s" : ""} worth a look.` : "Nothing to flag."} />
      <ul className="flex flex-col gap-2.5">
        {insights.map((i, idx) => (
          <li key={idx} className="flex gap-2 text-[13px] leading-snug">
            {ICON[i.level]}
            <span className={i.level === "ok" ? "text-fg-muted" : "text-fg"}>{i.message}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge>{stats.temperature === "warm" ? "Warm" : stats.temperature === "cool" ? "Cool" : "Balanced"}</Badge>
        <Badge>chroma {stats.averageChroma.toFixed(3)}</Badge>
        <Badge>lightness {stats.averageLightness.toFixed(2)}</Badge>
        <Badge>{stats.saturatedCount} vivid</Badge>
      </div>
      <Field label="Rationale" hint="appears in the guidelines" className="mt-5">
        <Textarea
          value={rationale}
          onChange={(e) =>
            editPalette((p) => {
              p.rationale = e.target.value;
            }, "Updated palette rationale", true)
          }
          placeholder="Why these colours? What does each one carry, and what should it never be used for?"
          rows={5}
        />
      </Field>
    </Card>
  );
}

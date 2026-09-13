"use client";
import * as React from "react";
import { Quote, ArrowUpToLine, Trash2, Plus, Check } from "lucide-react";
import { Badge, Button, Field, Input, Label } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { fontStack } from "@/lib/type/fonts";
import { cn } from "@/lib/utils";
import { DraftInput, LabCard } from "@/components/labs/brief/fields";
import { useStrategyUpdate } from "./useStrategy";

export function TaglineCard({ genome, className }: { genome: Genome; className?: string }) {
  const set = useStrategyUpdate();
  const s = genome.strategy;
  const display = genome.visual.typography.display;
  const [draftOption, setDraftOption] = React.useState("");

  const promote = (opt: string) =>
    set((st) => {
      const previous = st.tagline.trim();
      st.tagline = opt;
      if (previous && previous !== opt && !st.taglineOptions.includes(previous)) st.taglineOptions.push(previous);
    }, `tagline → “${opt}”`);
  const remove = (opt: string) => set((st) => void (st.taglineOptions = st.taglineOptions.filter((o) => o !== opt)), "tagline option removed");
  const add = () => {
    const v = draftOption.trim();
    if (!v) return;
    if (!s.taglineOptions.includes(v)) set((st) => void st.taglineOptions.push(v), "tagline option added");
    setDraftOption("");
  };

  return (
    <LabCard icon={<Quote />} title="Tagline" description="The line under the logo. Keep options alive until the identity settles; promote the winner." className={className}>
      <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          <div className="inset px-5 py-6 min-h-24 flex items-center">
            <span className="text-2xl leading-tight" style={{ fontFamily: fontStack(display.family, display.fallback) }}>
              {s.tagline || <span className="text-fg-subtle font-sans text-sm">No tagline yet</span>}
            </span>
          </div>
          <Field label="Current tagline">
            <DraftInput id="strategy-tagline" value={s.tagline} onCommit={(v) => set((st) => void (st.tagline = v), "tagline updated")} placeholder="Roasted under the lights." />
          </Field>
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <Label hint={`${s.taglineOptions.length} option${s.taglineOptions.length === 1 ? "" : "s"}`}>Options</Label>
          {s.taglineOptions.length ? (
            <ul className="flex flex-col gap-1.5">
              {s.taglineOptions.map((opt) => {
                const current = opt === s.tagline;
                return (
                  <li key={opt} className={cn("surface-2 pl-3 pr-1 py-1 flex items-center gap-2", current && "border-accent/50")}>
                    <span className="flex-1 min-w-0 text-sm truncate" style={{ fontFamily: fontStack(display.family, display.fallback) }} title={opt}>
                      {opt}
                    </span>
                    {current ? (
                      <Badge tone="accent">
                        <Check className="h-3 w-3" /> current
                      </Badge>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => promote(opt)} title="Promote to tagline" aria-label={`Promote “${opt}” to tagline`}>
                        <ArrowUpToLine className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(opt)} title="Delete option" aria-label={`Delete option “${opt}”`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="inset px-3 py-4 text-xs text-fg-subtle text-center">No options yet. Ask the Creative Director for five, or add your own.</div>
          )}
          <form
            className="flex gap-2 mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input value={draftOption} onChange={(e) => setDraftOption(e.target.value)} placeholder="Add an option…" aria-label="New tagline option" />
            <Button type="submit" variant="secondary" disabled={!draftOption.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </form>
        </div>
      </div>
    </LabCard>
  );
}

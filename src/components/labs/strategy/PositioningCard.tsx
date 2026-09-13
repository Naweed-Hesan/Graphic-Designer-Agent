"use client";
import * as React from "react";
import { Crosshair, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { EMPTY_POSITIONING, POSITIONING_FIELDS, composePositioning, parsePositioning, positioningComplete, positioningTokens, type PositioningParts } from "@/lib/strategy/positioning";
import { DraftTextarea, LabCard } from "@/components/labs/brief/fields";
import { useStrategyUpdate } from "./useStrategy";

export function PositioningCard({ genome, className }: { genome: Genome; className?: string }) {
  const set = useStrategyUpdate();
  const s = genome.strategy;
  const [open, setOpen] = React.useState(false);
  const [parts, setParts] = React.useState<PositioningParts>(EMPTY_POSITIONING);

  const openBuilder = () => {
    const parsed = parsePositioning(s.positioning);
    setParts({
      ...EMPTY_POSITIONING,
      brand: genome.brief.clientName || genome.name,
      category: genome.brief.industry,
      ...(parsed ?? {}),
    });
    setOpen(true);
  };

  const composed = composePositioning(parts);
  const complete = positioningComplete(parts);
  const useStatement = () => {
    set((st) => void (st.positioning = composed), "positioning composed with the builder");
    setOpen(false);
    toast.success("Positioning updated");
  };

  return (
    <LabCard
      icon={<Crosshair />}
      title="Positioning"
      description="One sentence: who it is for, what it is, and why it wins."
      className={className}
      actions={
        <Button variant="secondary" size="sm" onClick={openBuilder}>
          <Wand2 className="h-3.5 w-3.5" /> Positioning builder
        </Button>
      }
    >
      <DraftTextarea
        id="strategy-positioning"
        rows={5}
        value={s.positioning}
        onCommit={(v) => set((st) => void (st.positioning = v), "positioning updated")}
        placeholder="For [audience] who [need], [brand] is the [category] that [key benefit]. Unlike [alternative], we [differentiator]."
        aria-label="Positioning statement"
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Positioning builder" description="Fill the classic template; the statement composes itself as you type." wide>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {POSITIONING_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.optional ? `${f.hint} · optional` : f.hint}>
              <Input value={parts[f.key]} onChange={(e) => setParts({ ...parts, [f.key]: e.target.value })} placeholder={f.placeholder} />
            </Field>
          ))}
        </div>
        <div className="inset p-4 mt-4">
          <div className="label mb-2">Statement</div>
          <p className="font-display text-xl leading-snug">
            {positioningTokens(composed).map((t, i) => (
              <span key={i} className={t.placeholder ? "text-fg-subtle" : undefined}>
                {t.text}
              </span>
            ))}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={useStatement} disabled={!complete} title={complete ? undefined : "Fill the first sentence to continue"}>
            Use this statement
          </Button>
        </div>
      </Dialog>
    </LabCard>
  );
}

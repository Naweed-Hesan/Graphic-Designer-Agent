"use client";
import * as React from "react";
import { MessageCircleMore } from "lucide-react";
import { Chips, Field } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { ensureFont, fontStack } from "@/lib/type/fonts";
import { bestTextOn } from "@/lib/color/contrast";
import { DraftTextarea, LabCard } from "@/components/labs/brief/fields";
import { useStrategyUpdate } from "./useStrategy";

export function ToneCard({ genome, className }: { genome: Genome; className?: string }) {
  const set = useStrategyUpdate();
  const s = genome.strategy;
  const tone = s.tone;
  const { display, body } = genome.visual.typography;

  React.useEffect(() => {
    ensureFont(display.family, display.weights);
    ensureFont(body.family, body.weights);
  }, [display.family, display.weights, body.family, body.weights]);

  const colors = genome.visual.palette.colors;
  const paper = colors.find((c) => c.role === "background")?.hex;
  const ink = colors.find((c) => c.role === "text")?.hex ?? (paper ? bestTextOn(paper) : undefined);
  const accent = colors.find((c) => c.role === "primary")?.hex;
  const displayStack = fontStack(display.family, display.fallback);
  const bodyStack = fontStack(body.family, body.fallback);

  return (
    <LabCard icon={<MessageCircleMore />} title="Tone of voice" description="How the brand sounds. The preview sets your sample in the brand's own typefaces and paper." className={className}>
      <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5">
        <div className="flex flex-col gap-4">
          <Field label="Voice" hint="how it speaks, in a few lines">
            <DraftTextarea id="strategy-voice" rows={3} value={tone.voice} onCommit={(v) => set((st) => void (st.tone.voice = v), "voice updated")} placeholder="Calm, precise and quietly poetic. Short sentences." />
          </Field>
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
            <Field label="Do" hint="Enter to add">
              <div id="strategy-dos">
                <Chips value={tone.dos} onChange={(v) => set((st) => void (st.tone.dos = v), "voice dos updated")} placeholder="Name the farm and altitude" />
              </div>
            </Field>
            <Field label="Don't" hint="Enter to add">
              <div id="strategy-donts">
                <Chips value={tone.donts} onChange={(v) => set((st) => void (st.tone.donts = v), "voice don'ts updated")} placeholder="Say ‘artisanal’" />
              </div>
            </Field>
          </div>
          <Field label="Sample copy" hint="a line or two in the voice">
            <DraftTextarea id="strategy-sample" rows={3} value={tone.sample} onCommit={(v) => set((st) => void (st.tone.sample = v), "sample copy updated")} placeholder="Ethiopia, Guji. 2,100 m. Washed. Tastes like bergamot and the first hour of daylight." />
          </Field>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="label">Voice preview</div>
          <div
            className="flex-1 rounded-lg border border-line p-6 flex flex-col gap-4 min-h-60"
            style={{ background: paper ?? "var(--bg-inset)", color: ink ?? "var(--fg)", fontFamily: bodyStack }}
          >
            <div className="text-[11px] uppercase tracking-[0.1em] opacity-70">{genome.brief.clientName || genome.name}</div>
            <div className="text-[26px] leading-tight" style={{ fontFamily: displayStack, color: accent ?? undefined }}>
              {s.tagline || <span className="opacity-50">Your tagline sits here.</span>}
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{tone.sample || <span className="opacity-50">Sample copy appears here, set in the body typeface.</span>}</p>
            {tone.dos.length || tone.donts.length ? (
              <div className="mt-auto pt-2 text-[12px] leading-relaxed opacity-80">
                {tone.dos.length ? <div>Do: {tone.dos.join(" · ")}</div> : null}
                {tone.donts.length ? <div>Don&apos;t: {tone.donts.join(" · ")}</div> : null}
              </div>
            ) : null}
            <div className="text-[11px] opacity-60 mt-auto">
              {display.family} · {body.family}
            </div>
          </div>
        </div>
      </div>
    </LabCard>
  );
}

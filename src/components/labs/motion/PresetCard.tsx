"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { presetDuration, type MotionPreset, type MotionTag } from "@/lib/motion/presets";
import { buildTimeline, type PreparedSvg } from "@/lib/motion/timeline";
import { renderFrame } from "@/lib/motion/render";
import { cn } from "@/lib/utils";

const CARD_W = 168;
const CARD_H = 112;
const DPR = 2;
const ANIM_FRAMES = 15;
const HOLD_FRAMES = 5;

const TAG_TONE: Record<MotionTag, "info" | "warning" | "accent" | "success"> = { calm: "info", energetic: "warning", premium: "accent", playful: "success" };

export interface PresetCardProps {
  preset: MotionPreset;
  selected: boolean;
  onSelect: () => void;
  prepared: PreparedSvg | null;
  colors: { primary: string; accent: string };
  easingCss: string;
  background: string;
  padding: number;
  durationBase: number;
  ember: boolean;
}

/** Preset gallery card with a pre-rendered 20-frame strip that loops on hover / when selected. */
export function PresetCard({ preset, selected, onSelect, prepared, colors, easingCss, background, padding, durationBase, ember }: PresetCardProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const framesRef = React.useRef<HTMLCanvasElement[]>([]);
  const [ready, setReady] = React.useState(0);
  const [hover, setHover] = React.useState(false);
  const active = hover || selected;
  const duration = presetDuration(preset, durationBase);
  const transparent = background === "transparent";

  React.useEffect(() => {
    if (!prepared) return;
    let cancelled = false;
    const fps = ANIM_FRAMES / duration;
    const timeline = buildTimeline({ preset, duration, easing: easingCss, fps, hold: HOLD_FRAMES / fps, ember, ctx: { partCount: prepared.partCount, ...colors } });
    (async () => {
      const out: HTMLCanvasElement[] = [];
      for (let i = 0; i < timeline.frames; i++) {
        if (cancelled) return;
        try {
          out.push(await renderFrame({ svg: prepared.svg, prepared, directives: timeline.stateAt(i), width: CARD_W * DPR, height: CARD_H * DPR, background: transparent ? null : background, padding, colors }));
        } catch {
          return;
        }
      }
      if (cancelled) return;
      framesRef.current = out;
      setReady((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [prepared, preset, easingCss, background, transparent, padding, colors, duration, ember]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || !frames.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const blit = (i: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[Math.min(frames.length - 1, Math.max(0, i))], 0, 0);
    };
    if (!active) {
      blit(frames.length - 1);
      return;
    }
    const total = duration * (frames.length / ANIM_FRAMES);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) / 1000) % total;
      blit(Math.floor((t / total) * frames.length));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, ready, duration]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={cn("text-left surface-2 overflow-hidden transition-colors cursor-pointer flex flex-col min-w-0", selected ? "border-accent ring-1 ring-accent" : "hover:border-line-strong")}
      title={preset.description}
    >
      <div className={cn("relative border-b border-line", transparent && "checker")} style={transparent ? undefined : { background }}>
        <canvas ref={canvasRef} width={CARD_W * DPR} height={CARD_H * DPR} className="block w-full h-auto" aria-hidden="true" />
        {!ready ? <div className="absolute inset-0 shimmer" /> : null}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-bg-elev/85 px-1 font-mono text-[10px] text-fg-muted">{duration.toFixed(1)}s</span>
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium truncate">{preset.name}</span>
          {selected ? <Check className="h-3.5 w-3.5 text-accent shrink-0" /> : null}
        </div>
        <p className="text-[11px] text-fg-muted leading-snug line-clamp-2">{preset.description}</p>
        <div className="flex flex-wrap gap-1">
          {preset.tags.map((t) => (
            <Badge key={t} tone={TAG_TONE[t]}>
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}

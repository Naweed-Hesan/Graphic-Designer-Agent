"use client";
import * as React from "react";
import { AlertTriangle, Archive, Film, ImageIcon, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Field, Progress, Select, Slider, Spinner, Switch } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { useProject } from "@/lib/store/project";
import { normalizeSvg } from "@/lib/raster";
import { isValidEasingCss, resolveEasingCss } from "@/lib/motion/easing";
import { MAX_DURATION, MIN_DURATION, MOTION_PRESETS, getPreset, presetDuration, type MotionPreset } from "@/lib/motion/presets";
import { buildTimeline, prepare, type PreparedSvg, type Timeline } from "@/lib/motion/timeline";
import { codecLabel, encodeGif, encodePngSequence, encodeVideo, isAbortError, previewLoop, probeVideoSupport, renderFrame, type PreviewLoop, type VideoSupport } from "@/lib/motion/render";
import { cn, downloadBlob, formatBytes, slugify, svgToDataUrl } from "@/lib/utils";
import { ASPECTS, ASPECT_BY_ID, FPS_OPTIONS, RESOLUTIONS, brandColors, logoSources, outputSize, type Fps, type LogoAnimSettings } from "./shared";
import { EasingPicker } from "./EasingPicker";
import { PresetCard } from "./PresetCard";
import { MotionGallery } from "./MotionGallery";

type ExportKind = "mp4" | "webm" | "gif" | "png";

interface ExportJob {
  kind: ExportKind;
  done: number;
  total: number;
  phase: string;
}

const KIND_LABEL: Record<ExportKind, string> = { mp4: "MP4", webm: "WebM", gif: "GIF", png: "PNG sequence" };

function Transport({ loop, timeline }: { loop: PreviewLoop; timeline: Timeline }) {
  const snap = React.useSyncExternalStore(loop.subscribe, loop.getSnapshot, loop.getSnapshot);
  const frame = Math.min(timeline.frames - 1, Math.max(0, Math.round(snap.time * timeline.fps)));
  return (
    <div className="surface-2 px-3 py-2 flex items-center gap-2" data-testid="transport">
      <Button variant="secondary" size="icon-sm" onClick={() => loop.toggle()} title={snap.playing ? "Pause (space)" : "Play (space)"} aria-label={snap.playing ? "Pause" : "Play"} data-testid="play-toggle">
        {snap.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => loop.seek(0)} title="First frame" aria-label="First frame">
        <SkipBack className="h-3.5 w-3.5" />
      </Button>
      <Slider min={0} max={timeline.frames - 1} step={1} value={frame} onChange={(e) => loop.seek(Number(e.target.value) / timeline.fps)} aria-label="Scrub timeline" className="flex-1 mx-1" data-testid="scrubber" />
      <Button variant="ghost" size="icon-sm" onClick={() => loop.seek(timeline.timeAt(timeline.frames - 1))} title="Last frame" aria-label="Last frame">
        <SkipForward className="h-3.5 w-3.5" />
      </Button>
      <span className="font-mono text-[11px] text-fg-muted tabular-nums whitespace-nowrap min-w-[168px] text-right" data-testid="frame-counter">
        Frame {frame + 1} / {timeline.frames} · {(frame / timeline.fps).toFixed(2)} s
      </span>
    </div>
  );
}

export function LogoAnimationTab({ genome, settings, patch }: { genome: Genome; settings: LogoAnimSettings; patch: (p: Partial<LogoAnimSettings>) => void }) {
  const assets = useProject((s) => s.assets);
  const update = useProject((s) => s.update);
  const addAsset = useProject((s) => s.addAsset);

  const sources = React.useMemo(() => logoSources(genome, assets), [genome, assets]);
  const source = sources.find((s) => s.key === settings.sourceKey) ?? sources[0];
  const preset = getPreset(genome.visual.motion.preset);
  const brandEasing = genome.visual.motion.easing;
  const durationBase = genome.visual.motion.durationBase;
  const easingCss = settings.easingId === "custom" ? (isValidEasingCss(settings.customEasing) ? settings.customEasing : brandEasing) : resolveEasingCss(settings.easingId, brandEasing);
  const { primary, accent } = brandColors(genome);
  const colors = React.useMemo(() => ({ primary, accent }), [primary, accent]);
  const transparent = settings.background === "transparent";
  const aspect = ASPECT_BY_ID[settings.aspectId] ?? ASPECTS[0];
  const output = outputSize(settings.aspectId, settings.resolution);

  // Prepare the logo (ids + measured path lengths) off the render path.
  const [prepared, setPrepared] = React.useState<PreparedSvg | null>(null);
  const [prepError, setPrepError] = React.useState<string | null>(null);
  const sourceSvg = source?.svg ?? "";
  React.useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        setPrepared(prepare(sourceSvg));
        setPrepError(null);
      } catch (e) {
        setPrepared(null);
        setPrepError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [sourceSvg]);

  const partCount = prepared?.partCount ?? 1;
  const timeline = React.useMemo(
    () => buildTimeline({ preset, duration: settings.duration, easing: easingCss, fps: settings.fps, hold: settings.hold, ember: settings.ember, ctx: { partCount, ...colors } }),
    [preset, settings.duration, easingCss, settings.fps, settings.hold, settings.ember, partCount, colors],
  );

  // Preview canvas sizing (fit the container, cap the pixel budget).
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [box, setBox] = React.useState({ w: 720, dpr: 1 });
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setBox({ w, dpr: Math.min(2, window.devicePixelRatio || 1) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dispW = Math.max(120, Math.min(box.w, (520 * aspect.w) / aspect.h, 960));
  const pw = Math.round(Math.min(1400, dispW * box.dpr));
  const ph = Math.round((pw * aspect.h) / aspect.w);
  const previewBg = transparent ? null : settings.background;

  // Playback loop.
  const [loop] = React.useState(() => previewLoop({ draw: () => undefined, duration: 1 }));
  React.useEffect(() => {
    loop.play();
    return () => loop.pause();
  }, [loop]);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !prepared) return;
    loop.setDraw(async (t) => {
      await renderFrame({ svg: prepared.svg, prepared, directives: timeline.stateAtTime(t), width: pw, height: ph, background: previewBg, padding: settings.padding, colors, canvas });
    });
    loop.setDuration(timeline.total);
    loop.redraw();
  }, [loop, prepared, timeline, pw, ph, previewBg, settings.padding, colors]);

  // Encoder support.
  const [support, setSupport] = React.useState<VideoSupport | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    probeVideoSupport().then((s) => {
      if (!cancelled) setSupport(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Export.
  const [job, setJob] = React.useState<ExportJob | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const selectPreset = (p: MotionPreset) => {
    if (p.id !== genome.visual.motion.preset) update((g) => void (g.visual.motion.preset = p.id), { summary: `Motion preset → ${p.name}`, stage: "motion" });
    patch({ duration: presetDuration(p, durationBase) });
  };

  const runExport = async (kind: ExportKind) => {
    if (!prepared || job) return;
    loop.pause();
    const ac = new AbortController();
    abortRef.current = ac;
    const { width, height } = output;
    const full = buildTimeline({ preset, duration: settings.duration, easing: easingCss, fps: settings.fps, hold: settings.hold, ember: settings.ember, ctx: { partCount, ...colors } });
    // MP4 has no alpha channel: composite transparent exports over white.
    const background = transparent ? (kind === "mp4" ? "#ffffff" : null) : settings.background;
    setJob({ kind, done: 0, total: full.frames, phase: "Rendering frames" });
    const onProgress = (done: number, total: number) => setJob((j) => (j ? { ...j, done, total } : j));
    const frames = (i: number) => renderFrame({ svg: prepared.svg, prepared, directives: full.stateAt(i), width, height, background, padding: settings.padding, colors });
    const base = `${slugify(genome.name)}-${preset.id}-${width}x${height}`;
    try {
      let blob: Blob;
      let mime: string;
      let ext: string;
      let codec: string | undefined;
      if (kind === "gif") {
        blob = await encodeGif({ frames, count: full.frames, fps: settings.fps, width, height, maxSize: 720, transparent: background === null, onProgress, signal: ac.signal });
        mime = "image/gif";
        ext = "gif";
      } else if (kind === "png") {
        blob = await encodePngSequence({ frames, count: full.frames, prefix: base, onProgress, signal: ac.signal });
        mime = "application/zip";
        ext = "zip";
      } else {
        const r = await encodeVideo({ frames, count: full.frames, fps: settings.fps, width, height, format: kind, transparent: background === null, onProgress, signal: ac.signal });
        blob = r.blob;
        mime = r.mime;
        ext = r.ext;
        codec = r.codec;
      }
      const name = `${base}.${ext}`;
      downloadBlob(blob, name);
      await addAsset({
        kind: kind === "png" ? "file" : "video",
        name,
        mime,
        blob,
        width: kind === "gif" ? Math.round(width * Math.min(1, 720 / Math.max(width, height))) : width,
        height: kind === "gif" ? Math.round(height * Math.min(1, 720 / Math.max(width, height))) : height,
        duration: full.total,
        stage: "motion",
        tags: ["logo-animation", preset.id, kind === "png" ? "png-sequence" : ext, ...(codec ? [codec] : [])],
      });
      toast.success(`${KIND_LABEL[kind]} exported${codec ? ` (${codecLabel(codec)})` : ""} · ${formatBytes(blob.size)}`);
    } catch (e) {
      if (isAbortError(e)) toast.message("Export cancelled");
      else toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      abortRef.current = null;
      setJob(null);
    }
  };

  const supportNote = !support
    ? "Checking which video encoders this browser offers…"
    : !support.webcodecs
      ? "This browser has no WebCodecs VideoEncoder, so MP4/WebM export is unavailable — GIF and PNG sequences still work. Chrome, Edge and Safari 16.4+ support WebCodecs."
      : `MP4 via ${codecLabel(support.mp4)}${support.mp4 && support.mp4 !== "avc" ? " (H.264 not available in this browser)" : ""} · WebM via ${codecLabel(support.webm)}${transparent ? " · transparency is kept in WebM and GIF; MP4 is composited over white" : ""}`;

  const durationLabel = `${settings.duration.toFixed(1)} s`;

  return (
    <div className="flex flex-col gap-6">
      {/* Source */}
      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-sm font-medium">Source artwork</div>
            <div className="text-xs text-fg-muted">Any logo variant or SVG asset in the project. Top-level elements become the “parts” for staggered presets.</div>
          </div>
          {source?.placeholder ? (
            <Badge tone="warning">
              <AlertTriangle className="h-3 w-3" /> placeholder mark — no logo yet
            </Badge>
          ) : prepared ? (
            <Badge tone="neutral">
              {prepared.shapeCount} shapes · {prepared.partCount} parts
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Logo source">
          {sources.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={s.key === source?.key}
              onClick={() => patch({ sourceKey: s.key })}
              className={cn("flex items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors cursor-pointer", s.key === source?.key ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong bg-bg-elev-2")}
              title={s.label}
            >
              <span className="checker h-10 w-14 rounded-sm overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={svgToDataUrl(normalizeSvg(s.svg))} alt="" className="max-h-full max-w-full object-contain p-0.5" />
              </span>
              <span className="text-[12px] font-medium truncate max-w-[140px]">{s.label}</span>
            </button>
          ))}
        </div>
        {source?.placeholder ? <p className="text-xs text-fg-muted mt-3">This is a generated placeholder (brand initials on the primary colour). Create a mark in the Logo lab and it will show up here automatically.</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_296px]">
        {/* Preview + export */}
        <div className="flex flex-col gap-3 min-w-0">
          <div ref={wrapRef} className="surface p-3">
            <div
              className={cn("relative mx-auto overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", transparent && "checker")}
              style={{ width: dispW, aspectRatio: `${aspect.w} / ${aspect.h}`, background: transparent ? undefined : settings.background }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  loop.toggle();
                }
              }}
              aria-label="Animation preview — space toggles playback"
            >
              <canvas ref={canvasRef} width={pw} height={ph} className="block w-full h-full" data-testid="preview-canvas" />
              {prepError ? <div className="absolute inset-0 flex items-center justify-center bg-bg/80 p-4 text-center text-sm text-danger">{prepError}</div> : null}
              {!prepared && !prepError ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : null}
            </div>
          </div>
          <Transport loop={loop} timeline={timeline} />

          <div className="surface-2 p-3 flex flex-col gap-3" data-testid="export-panel">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label mr-1">Export</span>
              <Button size="sm" variant="secondary" disabled={!prepared || !!job || !support?.mp4} onClick={() => runExport("mp4")} title="MP4 via WebCodecs" data-testid="export-mp4">
                <Film className="h-3.5 w-3.5" /> MP4{support?.mp4 ? ` · ${codecLabel(support.mp4)}` : ""}
              </Button>
              <Button size="sm" variant="secondary" disabled={!prepared || !!job || !support?.webm} onClick={() => runExport("webm")} title="WebM via WebCodecs" data-testid="export-webm">
                <Film className="h-3.5 w-3.5" /> WebM{support?.webm ? ` · ${codecLabel(support.webm)}` : ""}
              </Button>
              <Button size="sm" variant="secondary" disabled={!prepared || !!job} onClick={() => runExport("gif")} title="Animated GIF (≤ 720 px)" data-testid="export-gif">
                <ImageIcon className="h-3.5 w-3.5" /> GIF
              </Button>
              <Button size="sm" variant="secondary" disabled={!prepared || !!job} onClick={() => runExport("png")} title="Every frame as PNG, zipped" data-testid="export-png">
                <Archive className="h-3.5 w-3.5" /> PNG sequence
              </Button>
              <span className="ml-auto text-[11px] text-fg-subtle font-mono tabular-nums">
                {output.width}×{output.height} · {settings.fps} fps · {timeline.frames} frames
              </span>
            </div>
            <p className="text-[11px] text-fg-muted leading-snug">{supportNote}</p>
            {job ? (
              <div className="flex items-center gap-3" data-testid="export-progress">
                <Progress value={job.total ? (job.done / job.total) * 100 : 0} className="flex-1" />
                <span className="text-[11px] font-mono text-fg-muted tabular-nums whitespace-nowrap">
                  {KIND_LABEL[job.kind]} · {job.done}/{job.total}
                </span>
                <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()} title="Cancel export" aria-label="Cancel export" data-testid="export-cancel">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Controls */}
        <aside className="surface p-4 flex flex-col gap-4" aria-label="Animation controls">
          <Field label="Duration" hint={durationLabel}>
            <div className="flex items-center gap-2">
              <Slider min={MIN_DURATION} max={MAX_DURATION} step={0.1} value={settings.duration} onChange={(e) => patch({ duration: Number(e.target.value) })} aria-label="Duration in seconds" data-testid="duration" />
              <Button variant="ghost" size="icon-sm" onClick={() => patch({ duration: presetDuration(preset, durationBase) })} title={`Reset to preset default (${presetDuration(preset, durationBase)} s from durationBase ${durationBase} ms)`} aria-label="Reset duration">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Field>
          <Field label="Easing">
            <EasingPicker id={settings.easingId} custom={settings.customEasing} brandCss={brandEasing} onChange={(easingId, customEasing) => patch({ easingId, customEasing })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frame rate">
              <Select value={settings.fps} onChange={(e) => patch({ fps: Number(e.target.value) as Fps })} aria-label="Frames per second" data-testid="fps">
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hold at end" hint={`${settings.hold.toFixed(1)} s`}>
              <Slider min={0} max={3} step={0.1} value={settings.hold} onChange={(e) => patch({ hold: Number(e.target.value) })} aria-label="Hold final frame" className="mt-2.5" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Canvas">
              <Select
                value={settings.aspectId}
                onChange={(e) => {
                  const a = ASPECT_BY_ID[e.target.value as keyof typeof ASPECT_BY_ID];
                  patch({ aspectId: a.id, resolution: a.defaultResolution });
                }}
                aria-label="Canvas aspect"
              >
                {ASPECTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Long edge">
              <Select value={settings.resolution} onChange={(e) => patch({ resolution: Number(e.target.value) })} aria-label="Resolution (long edge)" data-testid="resolution">
                {(RESOLUTIONS.includes(settings.resolution) ? RESOLUTIONS : [...RESOLUTIONS, settings.resolution].sort((a, b) => a - b)).map((r) => (
                  <option key={r} value={r}>
                    {r} px
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Background" hint={transparent ? "transparent" : settings.background.toUpperCase()}>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Background colour">
              {genome.visual.palette.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.background.toLowerCase() === c.hex.toLowerCase()}
                  onClick={() => patch({ background: c.hex })}
                  title={`${c.name} · ${c.hex}`}
                  aria-label={`${c.name} background`}
                  className={cn("h-7 w-7 rounded-full border border-line cursor-pointer transition-shadow", settings.background.toLowerCase() === c.hex.toLowerCase() && "ring-2 ring-accent ring-offset-2 ring-offset-bg-elev")}
                  style={{ background: c.hex }}
                />
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={settings.background.toLowerCase() === "#ffffff"}
                onClick={() => patch({ background: "#ffffff" })}
                title="White"
                aria-label="White background"
                className={cn("h-7 w-7 rounded-full border border-line-strong cursor-pointer bg-white", settings.background.toLowerCase() === "#ffffff" && "ring-2 ring-accent ring-offset-2 ring-offset-bg-elev")}
              />
              <button
                type="button"
                role="radio"
                aria-checked={transparent}
                onClick={() => patch({ background: "transparent" })}
                title="Transparent (WebM, GIF, PNG)"
                aria-label="Transparent background"
                className={cn("h-7 w-7 rounded-full border border-line-strong cursor-pointer checker", transparent && "ring-2 ring-accent ring-offset-2 ring-offset-bg-elev")}
              />
            </div>
          </Field>
          <Field label="Padding" hint={`${Math.round(settings.padding * 100)}%`}>
            <Slider min={0} max={0.4} step={0.01} value={settings.padding} onChange={(e) => patch({ padding: Number(e.target.value) })} aria-label="Padding around the logo" />
          </Field>
          <Switch checked={settings.ember} onChange={(ember) => patch({ ember })} label="Ember accent — a dot in the accent colour arrives last" />
        </aside>
      </div>

      {/* Presets */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Presets</h2>
            <p className="text-sm text-fg-muted">Timed from the Genome’s base duration ({durationBase} ms) and easing. Hover to preview; the selection is saved to the Genome.</p>
          </div>
          <Badge tone="accent">{preset.name}</Badge>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label="Animation preset" data-testid="preset-gallery">
          {MOTION_PRESETS.map((p) => (
            <PresetCard key={p.id} preset={p} selected={p.id === preset.id} onSelect={() => selectPreset(p)} prepared={prepared} colors={colors} easingCss={easingCss} background={settings.background} padding={settings.padding} durationBase={durationBase} ember={settings.ember} />
          ))}
        </div>
      </section>

      <MotionGallery />
    </div>
  );
}

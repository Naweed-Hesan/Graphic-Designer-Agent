"use client";
import * as React from "react";
import { AlertCircle, Download, RotateCcw, Sparkles, Square, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Field, Select, Slider, Spinner, Tabs, Textarea } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { assetUrl, useProject } from "@/lib/store/project";
import { generateVideo, type VideoGenParams } from "@/lib/api";
import { aspectToSize, compilePrompt } from "@/lib/imagery/prompt-compiler";
import { normalizeSvg } from "@/lib/raster";
import { prepare } from "@/lib/motion/timeline";
import { isAbortError, renderFrame } from "@/lib/motion/render";
import { motionWords } from "@/lib/motion/tokens";
import { blobToDataUrl, cn, dataUrlToBlob, downloadBlob, formatBytes, slugify, svgToDataUrl, uid } from "@/lib/utils";
import { MotionGallery } from "./MotionGallery";
import { brandColors, defaultBackground, extForMime, logoSources, type LogoAnimSettings } from "./shared";

type Mode = "text" | "image";
type Aspect = NonNullable<VideoGenParams["aspect"]>;
type Provider = NonNullable<VideoGenParams["provider"]>;

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const PROVIDERS: { id: Provider; label: string; note: string }[] = [
  { id: "auto", label: "Auto", note: "Tries providers in the order set under Providers → Video; unconfigured ones are skipped." },
  { id: "pollinations", label: "Pollinations", note: "Free text- and image-to-video with an enter.pollinations.ai key (weekly Pollen budget). Short clips, fastest turnaround." },
  { id: "hf-space", label: "HF Space", note: "Free ZeroGPU queue running LTX-2 / Wan. Slow — expect minutes; an HF token raises the quota." },
];

function subjectFor(genome: Genome): string {
  const concept = genome.visual.logo.concept || genome.strategy.positioning || genome.brief.description;
  return `${genome.name} brand film — ${concept || "an atmospheric hero scene for the brand"}`;
}

/** Splits the API error into the headline and per-provider attempts. */
function parseError(msg: string): { headline: string; attempts: string[] } {
  const [headline, rest] = msg.split(" — ");
  return { headline: headline.trim(), attempts: rest ? rest.split(" · ").map((s) => s.trim()).filter(Boolean) : [] };
}

export function AiVideoTab({ genome, settings }: { genome: Genome; settings: LogoAnimSettings }) {
  const assets = useProject((s) => s.assets);
  const addAsset = useProject((s) => s.addAsset);
  const images = assets.filter((a) => a.kind === "image");
  const source = logoSources(genome, assets).find((s) => s.key === settings.sourceKey) ?? logoSources(genome, assets)[0];

  const compiled = React.useMemo(() => compilePrompt({ genome, subject: subjectFor(genome), purpose: "hero" }), [genome]);
  const defaultPrompt = React.useMemo(() => `${compiled.prompt}. Motion: ${motionWords(genome)}.`, [compiled, genome]);

  const [mode, setMode] = React.useState<Mode>("text");
  const [imageKey, setImageKey] = React.useState<string>("logo");
  const [prompt, setPrompt] = React.useState(defaultPrompt);
  const [duration, setDuration] = React.useState(5);
  const [aspect, setAspect] = React.useState<Aspect>("16:9");
  const [provider, setProvider] = React.useState<Provider>("auto");
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string[]>([]);
  const [error, setError] = React.useState<{ headline: string; attempts: string[] } | null>(null);
  const [result, setResult] = React.useState<Asset | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const providerNote = PROVIDERS.find((p) => p.id === provider)?.note ?? "";

  const startFrame = async (): Promise<string> => {
    if (imageKey !== "logo") {
      const a = images.find((x) => x.id === imageKey);
      if (!a) throw new Error("Pick a start image");
      return blobToDataUrl(a.blob);
    }
    if (!source) throw new Error("No logo artwork available");
    const { width, height } = aspectToSize(aspect, 1024);
    const prepared = prepare(source.svg);
    const bg = settings.background === "transparent" ? defaultBackground(genome) : settings.background;
    const canvas = await renderFrame({ svg: prepared.svg, prepared, directives: {}, width, height, background: bg, padding: settings.padding, colors: brandColors(genome) });
    return canvas.toDataURL("image/png");
  };

  const generate = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setStatus(["Compiling request…"]);
    const ac = new AbortController();
    abortRef.current = ac;
    const push = (m: string) => setStatus((s) => [...s.slice(-60), m]);
    try {
      let inputImage: string | undefined;
      if (mode === "image") {
        inputImage = await startFrame();
        push(imageKey === "logo" ? "Rendered the logo as the start frame" : "Attached the start image");
      }
      push(`Requesting ${duration}s · ${aspect} · ${PROVIDERS.find((p) => p.id === provider)?.label ?? provider}`);
      const res = await generateVideo({ prompt, inputImage, duration, aspect, provider }, push, ac.signal);
      const blob = dataUrlToBlob(res.video.dataUrl);
      const mime = res.video.mime || blob.type || "video/mp4";
      const name = `${slugify(genome.name)}-${mode}-to-video-${uid(4)}.${extForMime(mime)}`;
      const asset = await addAsset({
        kind: "video",
        name,
        mime,
        blob,
        width: res.video.width,
        height: res.video.height,
        duration: res.video.duration ?? duration,
        stage: "motion",
        tags: ["ai-video", mode === "image" ? "image-to-video" : "text-to-video"],
        prompt,
        provider: res.video.provider,
        model: res.video.model,
      });
      setResult(asset);
      push(`Done via ${res.video.provider}${res.video.model ? ` · ${res.video.model}` : ""} · ${formatBytes(blob.size)}`);
      toast.success("Video saved to the project");
    } catch (e) {
      if (isAbortError(e)) {
        push("Cancelled");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        const parsed = parseError(msg);
        setError(parsed);
        push(`Failed: ${parsed.headline}`);
        toast.error(parsed.headline, { description: parsed.attempts.join("\n") || undefined });
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface p-5 flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Generate a brand video</h2>
              <p className="text-xs text-fg-muted mt-0.5">The prompt is compiled from the Genome (imagery style, palette, personality) plus your motion principles.</p>
            </div>
            <Tabs
              value={mode}
              onChange={setMode}
              items={[
                { value: "text", label: "Text to video" },
                { value: "image", label: "Image to video" },
              ]}
            />
          </div>

          {mode === "image" ? (
            <Field label="Start frame" hint="first frame of the clip">
              <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Start frame">
                <button
                  type="button"
                  role="radio"
                  aria-checked={imageKey === "logo"}
                  onClick={() => setImageKey("logo")}
                  className={cn("shrink-0 rounded-md border p-1.5 flex flex-col items-center gap-1 cursor-pointer", imageKey === "logo" ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong")}
                  title="Rendered logo frame (current Logo animation settings)"
                >
                  <span className="h-16 w-24 rounded-sm flex items-center justify-center overflow-hidden" style={{ background: settings.background === "transparent" ? defaultBackground(genome) : settings.background }}>
                    {source ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={svgToDataUrl(normalizeSvg(source.svg))} alt="" className="max-h-12 max-w-20 object-contain" />
                    ) : null}
                  </span>
                  <span className="text-[11px] text-fg-muted">Rendered logo</span>
                </button>
                {images.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={imageKey === a.id}
                    onClick={() => setImageKey(a.id)}
                    className={cn("shrink-0 rounded-md border p-1.5 flex flex-col items-center gap-1 cursor-pointer", imageKey === a.id ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong")}
                    title={a.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(a)} alt={a.name} className="h-16 w-24 rounded-sm object-cover" />
                    <span className="text-[11px] text-fg-muted truncate max-w-24">{a.name}</span>
                  </button>
                ))}
              </div>
              {!images.length ? <p className="text-[11px] text-fg-subtle mt-1">No image assets yet — generate some in the Imagery lab, or use the rendered logo frame.</p> : null}
            </Field>
          ) : null}

          <Field
            label="Prompt"
            hint={prompt === defaultPrompt ? "compiled from the Genome" : "edited"}
          >
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[150px] text-[13px]" data-testid="video-prompt" />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {compiled.notes.map((n) => (
                <Badge key={n} tone="neutral">
                  {n}
                </Badge>
              ))}
              <Badge tone="neutral">Motion principles</Badge>
              {prompt !== defaultPrompt ? (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPrompt(defaultPrompt)} title="Reset to the compiled prompt">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              ) : null}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Duration" hint={`${duration} s`}>
              <Slider min={3} max={10} step={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Video duration" className="mt-2.5" />
            </Field>
            <Field label="Aspect">
              <Select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)} aria-label="Aspect ratio">
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Provider">
              <Select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="Video provider" data-testid="video-provider">
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-[11px] text-fg-muted -mt-2">{providerNote}</p>

          <div className="flex items-center gap-2">
            <Button onClick={generate} loading={running} disabled={!prompt.trim()} data-testid="generate-video">
              {!running ? <Sparkles className="h-4 w-4" /> : null} Generate video
            </Button>
            {running ? (
              <Button variant="ghost" onClick={() => abortRef.current?.abort()} title="Cancel generation">
                <Square className="h-3.5 w-3.5" /> Cancel
              </Button>
            ) : null}
            <span className="text-[11px] text-fg-subtle ml-auto">Providers are contacted through your local server; keys never leave this machine.</span>
          </div>
        </section>

        <aside className="flex flex-col gap-4 min-w-0">
          <section className="surface p-4 flex flex-col gap-2" aria-live="polite" data-testid="video-status">
            <div className="text-sm font-medium flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-fg-muted" /> Status
              {running ? <Spinner className="ml-auto" /> : null}
            </div>
            {status.length ? (
              <ol className="inset p-2.5 font-mono text-[11px] leading-relaxed text-fg-muted max-h-[240px] overflow-y-auto flex flex-col gap-0.5">
                {status.map((s, i) => (
                  <li key={`${i}-${s}`} className={cn(i === status.length - 1 && "text-fg")}>
                    <span className="text-fg-subtle select-none">{String(i + 1).padStart(2, "0")} </span>
                    {s}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-fg-subtle">Streaming provider status appears here while a clip renders.</p>
            )}
            {error ? (
              <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs flex flex-col gap-1.5" role="alert" data-testid="video-error">
                <div className="flex items-center gap-1.5 font-medium text-danger">
                  <AlertCircle className="h-3.5 w-3.5" /> {error.headline}
                </div>
                {error.attempts.length ? (
                  <ul className="flex flex-col gap-1 text-fg-muted">
                    {error.attempts.map((a) => {
                      const [prov, ...rest] = a.split(":");
                      return (
                        <li key={a} className="font-mono text-[11px] break-words">
                          <span className="text-fg">{prov.trim()}</span>
                          {rest.length ? `: ${rest.join(":").trim()}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <p className="text-fg-subtle">Nothing was saved. Check keys under Providers, or switch provider and try again.</p>
              </div>
            ) : null}
          </section>

          {result ? (
            <section className="surface p-4 flex flex-col gap-3" data-testid="video-result">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Result</div>
                <Badge tone="success">saved to project</Badge>
              </div>
              <video src={assetUrl(result)} controls autoPlay loop muted playsInline className="w-full rounded-md bg-bg-inset" />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadBlob(result.blob, result.name)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <span className="text-[11px] text-fg-subtle">
                  {result.provider}
                  {result.model ? ` · ${result.model}` : ""} · {formatBytes(result.blob.size)}
                </span>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <MotionGallery />
    </div>
  );
}

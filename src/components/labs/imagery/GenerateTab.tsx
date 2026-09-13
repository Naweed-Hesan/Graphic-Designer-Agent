"use client";
import * as React from "react";
import { Check, CircleAlert, CircleStop, Dices, Download, Info, Lock, LockOpen, RotateCcw, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Field, Input, Progress, SectionHeader, Select, Spinner, Switch, Textarea } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { providerConfigured, useSettings } from "@/lib/store/settings";
import { generateImage } from "@/lib/api";
import type { Asset } from "@/lib/db";
import { aspectToSize, compilePrompt, type ImagePurpose } from "@/lib/imagery/prompt-compiler";
import { ASPECTS, PLATFORM_PRESETS, PURPOSES, PURPOSE_BY_ID } from "@/lib/imagery/presets";
import {
  type AttemptInfo,
  PROVIDER_BY_ID,
  PROVIDER_OPTIONS,
  type ProviderChoice,
  formatMs,
  generationAssetName,
  narrateAttempts,
  parseAttemptsFromError,
  randomSeed,
  resolveSize,
} from "@/lib/imagery/generation";
import { blobToDataUrlResized, dataUrlToBlob } from "@/lib/imagery/image-utils";
import { cn, downloadBlob, uid } from "@/lib/utils";
import { AssetImage, AttemptList, PromptNotes, ReferenceStrip, Segmented, SuggestionChips, TileButton, markImageryInProgress, setStyleReferences, useReferenceIds } from "./shared";
import { Lightbox } from "./Lightbox";

interface LogEntry {
  id: string;
  kind: "info" | "ok" | "error";
  text: string;
  attempts?: AttemptInfo[];
}

export function GenerateTab() {
  const genome = useProject((s) => s.genome);
  const assets = useProject((s) => s.assets);
  const addAsset = useProject((s) => s.addAsset);
  const removeAsset = useProject((s) => s.removeAsset);
  const settings = useSettings();
  const refIds = useReferenceIds();

  const [subject, setSubject] = React.useState("");
  const [purpose, setPurpose] = React.useState<ImagePurpose>("hero");
  const [sizeChoice, setSizeChoice] = React.useState("auto");
  const [count, setCount] = React.useState(1);
  const [provider, setProvider] = React.useState<ProviderChoice>("auto");
  const [model, setModel] = React.useState("");
  const [seedLocked, setSeedLocked] = React.useState(false);
  const [seed, setSeed] = React.useState<number | null>(null);
  const [extra, setExtra] = React.useState("");
  const [includeHex, setIncludeHex] = React.useState(true);
  const [useReference, setUseReference] = React.useState(false);
  const [promptOverride, setPromptOverride] = React.useState<string | null>(null);
  const [negOverride, setNegOverride] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [status, setStatus] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [results, setResults] = React.useState<string[]>([]);
  const [lightboxId, setLightboxId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  if (!genome) return null;

  const preset = PURPOSE_BY_ID[purpose];
  const effectiveSubject = subject.trim() || preset.examples[0];
  const compiled = compilePrompt({ genome, subject: effectiveSubject, purpose, extra, includeHex });
  const size = resolveSize(sizeChoice, compiled.aspectHint);
  const prompt = promptOverride ?? compiled.prompt;
  const negativePrompt = negOverride ?? compiled.negativePrompt;
  const edited = promptOverride !== null || negOverride !== null;
  const firstRef = refIds.map((id) => assets.find((a) => a.id === id)).find((a): a is Asset => Boolean(a));
  const providerOpt = PROVIDER_BY_ID[provider];
  const configured = settings.image.order.filter((id) => providerConfigured(settings, id));
  const providerReady = provider === "auto" ? configured.length > 0 : providerConfigured(settings, provider);
  const modelPlaceholder =
    provider === "pollinations"
      ? settings.providers.pollinations.imageModel
      : provider === "cloudflare"
        ? settings.providers.cloudflare.imageModel
        : provider === "gemini"
          ? settings.providers.gemini.imageModel
          : provider === "hf-space"
            ? settings.providers.huggingface.imageSpace
            : "provider default";
  const resultAssets = results.map((id) => assets.find((a) => a.id === id)).filter((a): a is Asset => Boolean(a));

  const run = async () => {
    if (running) return;
    if (!subject.trim() && promptOverride === null) {
      toast.error("Describe a subject first");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setProgress({ done: 0, total: count });
    setLog([]);
    const push = (e: Omit<LogEntry, "id">) => setLog((l) => [...l, { id: uid(6), ...e }]);
    const chain = provider === "auto" ? configured.join(" → ") : provider;
    try {
      let inputImage: string | undefined;
      if (useReference && firstRef) {
        setStatus("Preparing reference image…");
        inputImage = await blobToDataUrlResized(firstRef.blob, 1024);
      }
      for (let i = 0; i < count; i++) {
        if (ctrl.signal.aborted) break;
        const s = seedLocked && seed != null ? seed + i : randomSeed();
        setStatus(`Image ${i + 1} of ${count} · ${size.width}×${size.height} · seed ${s} · ${chain || "no configured providers"}`);
        push({ kind: "info", text: `Requesting image ${i + 1}/${count} · ${size.width}×${size.height} · seed ${s} · via ${chain || provider}` });
        const t0 = Date.now();
        try {
          const { image, attempts } = await generateImage(
            { prompt, negativePrompt, width: size.width, height: size.height, seed: s, provider, model: model.trim() || undefined, purpose, inputImage },
            ctrl.signal,
          );
          const asset = await addAsset({
            kind: "image",
            name: generationAssetName(purpose, effectiveSubject, image.seed ?? s, image.mime),
            mime: image.mime,
            blob: dataUrlToBlob(image.dataUrl),
            width: image.width,
            height: image.height,
            prompt,
            provider: image.provider,
            model: image.model,
            seed: image.seed ?? s,
            stage: "imagery",
            tags: [purpose, "ai"],
          });
          markImageryInProgress();
          setResults((r) => [asset.id, ...r]);
          push({ kind: "ok", text: `${image.provider} · ${image.model} · ${image.width}×${image.height} · ${formatMs(Date.now() - t0)}`, attempts });
        } catch (e) {
          if (ctrl.signal.aborted) {
            push({ kind: "info", text: "Cancelled" });
            break;
          }
          const parsed = parseAttemptsFromError(e instanceof Error ? e.message : String(e));
          push({ kind: "error", text: parsed.summary, attempts: parsed.attempts });
          toast.error(parsed.summary, { description: parsed.attempts.length ? narrateAttempts(parsed.attempts).join("\n") : undefined });
          break;
        } finally {
          setProgress({ done: i + 1, total: count });
        }
      }
    } finally {
      setRunning(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();
  const lockSeed = (value: number) => {
    setSeed(value);
    setSeedLocked(true);
  };
  const deleteResult = async (a: Asset) => {
    if (!confirm(`Delete “${a.name}”?`)) return;
    if (refIds.includes(a.id)) setStyleReferences([a.id], false);
    await removeAsset(a.id);
    setResults((r) => r.filter((id) => id !== a.id));
  };

  return (
    <div className="flex flex-col gap-5">
      <ReferenceStrip onOpen={setLightboxId} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <Card className="flex flex-col gap-4">
          <SectionHeader title="Brief the model" description="The Genome supplies medium, palette and personality — you supply the subject." className="mb-0" />

          <Field label="Subject" hint="what is in the picture">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={preset.examples[0]}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
              }}
            />
            <SuggestionChips className="mt-1.5" items={preset.examples} isActive={(s) => s === subject} onPick={(s) => setSubject(s === subject ? "" : s)} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Purpose">
              <Select value={purpose} onChange={(e) => setPurpose(e.target.value as ImagePurpose)}>
                {PURPOSES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-fg-muted mt-1.5">{preset.description}</p>
            </Field>
            <Field label="Size" hint={`${size.width}×${size.height}`}>
              <Select value={sizeChoice} onChange={(e) => setSizeChoice(e.target.value)}>
                <option value="auto">Auto — {compiled.aspectHint} from purpose</option>
                <optgroup label="Aspect">
                  {ASPECTS.map((a) => {
                    const s = aspectToSize(a.id);
                    return (
                      <option key={a.id} value={`aspect:${a.id}`}>
                        {a.label} {a.id} · {s.width}×{s.height}
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Platforms">
                  {PLATFORM_PRESETS.map((p) => (
                    <option key={p.id} value={`platform:${p.id}`}>
                      {p.platform} {p.label} · {p.width}×{p.height}
                    </option>
                  ))}
                </optgroup>
              </Select>
              <p className="text-xs text-fg-muted mt-1.5">Providers snap to their nearest supported size.</p>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Count" hint="sequential requests">
              <Segmented ariaLabel="Number of images" value={count} onChange={setCount} options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
            <Field label="Seed" hint={seedLocked ? "locked · +1 per image" : "new random seed per image"}>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => (seedLocked ? setSeedLocked(false) : lockSeed(seed ?? randomSeed()))}
                  title={seedLocked ? "Unlock seed" : "Lock seed"}
                  aria-pressed={seedLocked}
                  className="shrink-0"
                >
                  {seedLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  {seedLocked ? "Locked" : "Random"}
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={seedLocked && seed != null ? seed : ""}
                  placeholder="random"
                  disabled={!seedLocked}
                  onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)}
                  aria-label="Seed"
                  className="font-mono"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => lockSeed(randomSeed())} title="Roll a new seed and lock it" className="shrink-0">
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider">
              <Select value={provider} onChange={(e) => setProvider(e.target.value as ProviderChoice)}>
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.id !== "auto" && !providerConfigured(settings, p.id) ? " · key needed" : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-fg-muted mt-1.5">{providerOpt.note}</p>
            </Field>
            <Field label="Model override" hint="optional">
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={modelPlaceholder} className="font-mono text-[13px]" />
              <p className="text-xs text-fg-muted mt-1.5">{provider === "auto" ? "Sent to whichever provider answers; leave empty for each provider's default." : `Default: ${modelPlaceholder}`}</p>
            </Field>
          </div>

          <div className="inset px-3 py-2 text-xs text-fg-muted flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-fg-subtle" />
            <span>
              Free tiers: Pollinations needs no key; Cloudflare gives about 170 FLUX images a day; Gemini&apos;s image quota varies by model; Hugging Face Spaces queue on free GPUs. Keys and fallback order live under Providers (⌘,).
              Ready now: <span className="font-mono text-fg">{configured.join(", ") || "none"}</span>.
            </span>
          </div>

          <Field label="Extra direction" hint="appended after the compiled prompt">
            <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. eye-level, morning, a little fog" />
          </Field>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Switch checked={includeHex} onChange={setIncludeHex} label="Include palette hex codes" />
            <Switch
              checked={useReference && Boolean(firstRef)}
              onChange={setUseReference}
              label="Condition on the first reference (image-to-image)"
              className={cn(!firstRef && "opacity-50 pointer-events-none")}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="label">Prompt</div>
              <div className="flex items-center gap-1.5">
                {edited ? <Badge tone="warning">edited</Badge> : <Badge tone="success">compiled live</Badge>}
                {edited && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPromptOverride(null);
                      setNegOverride(null);
                    }}
                    title="Back to the compiled prompt"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                )}
              </div>
            </div>
            <Textarea value={prompt} onChange={(e) => setPromptOverride(e.target.value)} rows={8} className="font-mono text-[12px] leading-relaxed" aria-label="Prompt" data-testid="generate-prompt" />
            <PromptNotes notes={compiled.notes} aspect={compiled.aspectHint} />
            <Field label="Negative prompt" hint="native where supported, folded in otherwise">
              <Textarea value={negativePrompt} onChange={(e) => setNegOverride(e.target.value)} rows={2} className="font-mono text-[12px] min-h-[52px]" aria-label="Negative prompt" />
            </Field>

            {running ? (
              <div className="flex flex-col gap-2">
                <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
                  <span className="flex items-center gap-2 min-w-0">
                    <Spinner className="h-3 w-3 shrink-0" /> <span className="truncate">{status}</span>
                  </span>
                  <Button variant="secondary" size="sm" onClick={cancel} className="shrink-0">
                    <CircleStop className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="lg" onClick={run} disabled={!providerReady} className="w-full" title={providerReady ? "Generate (⌘/Ctrl+Enter in the subject field)" : "No image provider is configured"}>
                <Sparkles className="h-4 w-4" /> Generate {count > 1 ? `${count} images` : "image"}
              </Button>
            )}
            {!providerReady && <p className="text-xs text-warning">No image provider is configured. Pollinations works without a key — add it back to the fallback order under Providers.</p>}
          </Card>
        </div>
      </div>

      {(log.length > 0 || resultAssets.length > 0) && (
        <Card className="flex flex-col gap-4">
          <SectionHeader
            title="This session"
            description={resultAssets.length ? `${resultAssets.length} saved to the Gallery` : undefined}
            className="mb-0"
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLog([]);
                  setResults([]);
                }}
                disabled={running}
              >
                Clear
              </Button>
            }
          />
          {resultAssets.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {resultAssets.map((a) => {
                const isRef = refIds.includes(a.id);
                return (
                  <div key={a.id} className="group relative shrink-0 w-44">
                    <button type="button" onClick={() => setLightboxId(a.id)} className="block w-full aspect-square rounded-md overflow-hidden border border-line bg-bg-inset cursor-zoom-in" title="Open">
                      <AssetImage asset={a} className="h-full w-full object-cover" />
                    </button>
                    <div className="mt-1.5 text-[11px] text-fg-muted font-mono truncate">
                      {a.provider} · seed {a.seed ?? "—"}
                    </div>
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <TileButton title={isRef ? "Unpin style reference" : "Set as style reference"} active={isRef} onClick={() => setStyleReferences([a.id], !isRef)}>
                        <Star className={cn("h-3.5 w-3.5", isRef && "fill-current")} />
                      </TileButton>
                      {a.seed != null && (
                        <TileButton title="Lock this seed" onClick={() => lockSeed(a.seed!)}>
                          <Lock className="h-3.5 w-3.5" />
                        </TileButton>
                      )}
                      <TileButton title="Download" onClick={() => downloadBlob(a.blob, a.name)}>
                        <Download className="h-3.5 w-3.5" />
                      </TileButton>
                      <TileButton title="Delete" onClick={() => deleteResult(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </TileButton>
                    </div>
                    {isRef && <Star className="absolute top-2 left-2 h-4 w-4 text-accent fill-current drop-shadow pointer-events-none" />}
                  </div>
                );
              })}
            </div>
          )}
          {log.length > 0 && (
            <div className="inset p-3 flex flex-col gap-2 max-h-72 overflow-y-auto" data-testid="generation-log" aria-live="polite">
              {log.map((e) => (
                <div key={e.id} className="text-xs">
                  <div className="flex items-start gap-2">
                    {e.kind === "ok" ? (
                      <Check className="h-3.5 w-3.5 text-success shrink-0 mt-px" />
                    ) : e.kind === "error" ? (
                      <CircleAlert className="h-3.5 w-3.5 text-danger shrink-0 mt-px" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center text-fg-subtle">·</span>
                    )}
                    <span className={cn("break-words min-w-0", e.kind === "error" ? "text-danger" : e.kind === "info" ? "text-fg-muted" : "text-fg")}>{e.text}</span>
                  </div>
                  {e.attempts?.length ? <AttemptList attempts={e.attempts} className="ml-5 mt-1" /> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Lightbox assetId={lightboxId} ids={[...resultAssets.map((a) => a.id), ...refIds.filter((id) => !results.includes(id))]} onClose={() => setLightboxId(null)} onSelect={setLightboxId} />
    </div>
  );
}

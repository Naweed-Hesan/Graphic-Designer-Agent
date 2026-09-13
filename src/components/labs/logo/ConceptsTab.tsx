"use client";
import * as React from "react";
import { toast } from "sonner";
import { Download, PenTool, Shuffle, Sparkles, Trash2, Upload, ImagePlus } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, Label } from "@/components/ui";
import { useProject, assetUrl } from "@/lib/store/project";
import type { Asset } from "@/lib/db";
import { generateImage, type ImageGenParams } from "@/lib/api";
import { compilePrompt, aspectToSize } from "@/lib/imagery/prompt-compiler";
import { blobToImage, svgSize } from "@/lib/raster";
import { sanitizeSvg } from "@/lib/logo/svg";
import { cn, dataUrlToBlob, downloadBlob, slugify, timeAgo } from "@/lib/utils";
import { CONCEPT_TAG, MARK_TAG, errorMessage, useLogoConcepts } from "./shared";

const STYLE_CHIPS = ["geometric", "monoline", "negative space", "lettermark", "monogram", "abstract", "emblem", "mascot", "organic", "pictorial"];

type ProviderId = NonNullable<ImageGenParams["provider"]>;
const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "auto", label: "Auto (fallback chain)" },
  { id: "pollinations", label: "Pollinations" },
  { id: "cloudflare", label: "Cloudflare Workers AI" },
  { id: "gemini", label: "Gemini" },
  { id: "hf-space", label: "Hugging Face Space" },
];

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

function randomSeed() {
  return Math.floor(Math.random() * 2_147_483_647);
}

export function ConceptsTab({ onVectorise, onMarkSet }: { onVectorise: (assetId: string) => void; onMarkSet: () => void }) {
  const genome = useProject((s) => s.genome)!;
  const update = useProject((s) => s.update);
  const addAsset = useProject((s) => s.addAsset);
  const removeAsset = useProject((s) => s.removeAsset);
  const concepts = useLogoConcepts();

  const [subject, setSubject] = React.useState("");
  const [styles, setStyles] = React.useState<string[]>([]);
  const [count, setCount] = React.useState(2);
  const [provider, setProvider] = React.useState<ProviderId>("auto");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const logo = genome.visual.logo;
  const abortRef = React.useRef<AbortController | null>(null);

  const compiled = React.useMemo(() => {
    const subj = subject.trim() || logo.concept.trim() || `${genome.name} brand mark`;
    return compilePrompt({ genome, subject: subj, purpose: "logo-concept", extra: styles.length ? `${styles.join(", ")} style` : "" });
  }, [genome, subject, styles, logo.concept]);

  const commitConcept = (value: string) => {
    if (value === logo.concept) return;
    update((g) => void (g.visual.logo.concept = value), { summary: "Updated logo concept brief", stage: "logo" });
  };

  const saveGenerated = async (params: { prompt: string; negativePrompt: string; seed: number; name: string; parentId?: string }) => {
    const { width, height } = aspectToSize("1:1", 1024);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { image, attempts } = await generateImage(
      { prompt: params.prompt, negativePrompt: params.negativePrompt, width, height, seed: params.seed, provider: provider === "auto" ? undefined : provider, purpose: "logo-concept" },
      ctrl.signal,
    );
    const blob = dataUrlToBlob(image.dataUrl);
    const asset = await addAsset({
      kind: "image",
      name: params.name,
      mime: image.mime || blob.type || "image/png",
      blob,
      width: image.width,
      height: image.height,
      prompt: params.prompt,
      provider: image.provider,
      model: image.model,
      seed: image.seed ?? params.seed,
      parentId: params.parentId,
      stage: "logo",
      tags: [CONCEPT_TAG, "ai"],
    });
    update(
      (g) => {
        g.visual.logo.concepts.push(asset.id);
        if (!g.stages.logo || g.stages.logo === "todo") g.stages.logo = "in-progress";
      },
      { summary: `Generated logo concept (${image.provider})`, stage: "logo" },
    );
    const failed = attempts.filter((a) => !a.ok);
    toast.success(`Concept via ${image.provider}${image.model ? ` · ${image.model}` : ""}${failed.length ? ` — after ${failed.map((a) => a.provider).join(", ")} failed` : ""}`);
    return asset;
  };

  const generate = async () => {
    setBusy("generate");
    const n0 = concepts.length;
    try {
      for (let i = 0; i < count; i++) {
        await saveGenerated({ prompt: compiled.prompt, negativePrompt: compiled.negativePrompt, seed: randomSeed(), name: `Concept ${n0 + i + 1}` });
      }
    } catch (e) {
      toast.error(errorMessage(e), { duration: 8000 });
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  };

  const variations = async (a: Asset) => {
    if (!a.prompt) return;
    setBusy(a.id);
    try {
      await saveGenerated({ prompt: a.prompt, negativePrompt: compiled.negativePrompt, seed: randomSeed(), name: `${a.name} · variation`, parentId: a.id });
    } catch (e) {
      toast.error(errorMessage(e), { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: Asset) => {
    await removeAsset(a.id);
    update((g) => void (g.visual.logo.concepts = g.visual.logo.concepts.filter((id) => id !== a.id)), { summary: `Deleted concept ${a.name}`, stage: "logo" });
    toast.message(`Deleted ${a.name}`);
  };

  const importFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^image\//.test(f.type));
    if (!list.length) {
      toast.error("Drop a PNG, JPG, WebP or SVG");
      return;
    }
    setBusy("upload");
    try {
      for (const file of list) {
        const base = file.name.replace(/\.[a-z0-9]+$/i, "") || "Upload";
        if (file.type === "image/svg+xml") {
          const svg = sanitizeSvg(await file.text());
          if (!/<svg\b/i.test(svg)) throw new Error(`${file.name} is not an SVG`);
          const size = svgSize(svg);
          const asset = await addAsset({ kind: "svg", name: base, mime: "image/svg+xml", blob: new Blob([svg], { type: "image/svg+xml" }), svg, width: size.width, height: size.height, stage: "logo", tags: [MARK_TAG, "upload"] });
          update(
            (g) => {
              g.visual.logo.markAssetId = asset.id;
              g.visual.logo.variants.mark = asset.id;
              if (!g.stages.logo || g.stages.logo === "todo") g.stages.logo = "in-progress";
            },
            { summary: `Uploaded SVG mark ${base}`, stage: "logo" },
          );
          toast.success(`${file.name} set as the mark — build lockups next`);
          onMarkSet();
        } else {
          const img = await blobToImage(file);
          const asset = await addAsset({ kind: "image", name: base, mime: file.type, blob: file, width: img.naturalWidth, height: img.naturalHeight, stage: "logo", tags: [CONCEPT_TAG, "upload"] });
          update((g) => void g.visual.logo.concepts.push(asset.id), { summary: `Uploaded concept ${base}`, stage: "logo" });
          toast.success(`${file.name} added — tracing it now`);
          onVectorise(asset.id);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleStyle = (s: string) => setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr] items-start">
      {/* Brief + generator */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div>
            <div className="label mb-1">Concept brief</div>
            <p className="text-[12px] text-fg-muted mb-2">The idea behind the mark. It is compiled into every generation prompt and printed in the guidelines.</p>
            <Textarea key={logo.concept} defaultValue={logo.concept} placeholder="e.g. A single continuous line that reads as both a rising sun and a curl of steam." onBlur={(e) => commitConcept(e.target.value.trim())} rows={4} aria-label="Concept brief" />
          </div>
          <Field label="Subject" hint="what the mark depicts">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={logo.concept ? "defaults to the brief above" : "e.g. rising sun over a horizon"} />
          </Field>
          <div>
            <Label>Style</Label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_CHIPS.map((s) => {
                const on = styles.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleStyle(s)} aria-pressed={on} className={cn("rounded-full border px-2.5 h-7 text-[12px] transition-colors cursor-pointer", on ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg")}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <Field label="Count">
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of concepts">
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Provider">
              <Select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)} aria-label="Image provider">
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <details className="text-[12px] text-fg-muted">
            <summary className="cursor-pointer select-none hover:text-fg">Compiled prompt</summary>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-fg-muted whitespace-pre-wrap break-words inset p-2.5">{compiled.prompt}</p>
            {compiled.notes.length ? <p className="mt-1.5 text-fg-subtle">Injected: {compiled.notes.join(" · ")}</p> : null}
          </details>
          <Button onClick={generate} loading={busy === "generate"} disabled={busy !== null && busy !== "generate"} className="w-full">
            <Sparkles className="h-4 w-4" /> Generate {count} concept{count > 1 ? "s" : ""}
          </Button>
        </Card>

        {/* Upload */}
        <div
          className={cn("inset grid-dots flex flex-col items-center justify-center gap-2 p-6 text-center transition-colors", dragging && "border-accent bg-accent-soft/40")}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragging) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void importFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="h-5 w-5 text-fg-subtle" />
          <div className="text-sm font-medium">Bring your own artwork</div>
          <p className="text-[12px] text-fg-muted max-w-xs">Drop a PNG/JPG sketch to trace it, or an SVG to use it directly as the mark.</p>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy === "upload"}>
            <ImagePlus className="h-4 w-4" /> Choose file
          </Button>
          <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden aria-label="Upload logo artwork" data-testid="logo-upload-input" onChange={(e) => e.target.files && void importFiles(e.target.files)} />
        </div>
      </div>

      {/* Concept grid */}
      <div>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold">Concepts</h2>
            <p className="text-[12px] text-fg-muted">{concepts.length ? `${concepts.length} exploration${concepts.length === 1 ? "" : "s"} — pick one to vectorise.` : "Generated and uploaded explorations land here."}</p>
          </div>
        </div>
        {concepts.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="No concepts yet"
            description="Generate a few directions from the brief, or upload a sketch. Generation needs an image provider; uploads always work."
            action={
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload artwork
              </Button>
            }
            className="min-h-[320px]"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {concepts.map((a) => (
              <ConceptCard key={a.id} asset={a} busy={busy === a.id} onVectorise={() => onVectorise(a.id)} onVariations={() => variations(a)} onDelete={() => remove(a)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptCard({ asset, busy, onVectorise, onVariations, onDelete }: { asset: Asset; busy: boolean; onVectorise: () => void; onVariations: () => void; onDelete: () => void }) {
  const url = assetUrl(asset);
  const isAi = asset.tags.includes("ai");
  return (
    <div className="surface-2 overflow-hidden group flex flex-col">
      <button type="button" onClick={onVectorise} className="checker aspect-square w-full overflow-hidden cursor-pointer" title="Vectorise this concept">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={asset.name} className="h-full w-full object-contain" />
      </button>
      <div className="px-3 pt-2 pb-1 flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-medium truncate flex-1">{asset.name}</span>
        <Badge tone={isAi ? "accent" : "neutral"}>{isAi ? asset.provider ?? "AI" : "upload"}</Badge>
      </div>
      <div className="px-3 pb-2 text-[11px] text-fg-subtle flex items-center justify-between gap-2">
        <span>
          {asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}
          {asset.seed !== undefined ? ` · seed ${asset.seed}` : ""}
        </span>
        <span>{timeAgo(asset.createdAt)}</span>
      </div>
      <div className="flex items-center gap-0.5 border-t border-line px-1.5 py-1">
        <Button variant="ghost" size="sm" onClick={onVectorise} title="Vectorise">
          <PenTool className="h-3.5 w-3.5" /> Vectorise
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onVariations} disabled={!asset.prompt} loading={busy} title={asset.prompt ? "Generate variations (same prompt, new seed)" : "Variations need a generated concept"}>
          <Shuffle className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => downloadBlob(asset.blob, `${slugify(asset.name)}.${asset.mime.includes("jpeg") ? "jpg" : asset.mime.includes("webp") ? "webp" : "png"}`)} title="Download">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete" className="ml-auto hover:text-danger">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

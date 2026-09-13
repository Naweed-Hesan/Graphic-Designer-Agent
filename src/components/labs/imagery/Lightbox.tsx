"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CircleAlert, Copy, Download, Scissors, Shuffle, Star, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Dialog, Field, Progress, Select, Spinner, Switch, Textarea } from "@/components/ui";
import { useAsset, useProject } from "@/lib/store/project";
import { generateImage } from "@/lib/api";
import { compilePrompt } from "@/lib/imagery/prompt-compiler";
import {
  type AttemptInfo,
  EDIT_PROVIDERS,
  PROVIDER_BY_ID,
  type ProviderChoice,
  deriveAssetName,
  extForMime,
  fitSizeForApi,
  parseAttemptsFromError,
  purposeFromTags,
  randomSeed,
} from "@/lib/imagery/generation";
import { blobToDataUrlResized, dataUrlToBlob, readImageSize } from "@/lib/imagery/image-utils";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { AssetImage, AttemptList, markImageryInProgress, originOf, purposeLabel, setStyleReferences, useReferenceIds } from "./shared";

type Busy = null | "background" | "edit" | "variation";

const BUSY_LABEL: Record<Exclude<Busy, null>, string> = {
  background: "Removing background…",
  edit: "Applying edit…",
  variation: "Generating a variation…",
};

export function Lightbox({ assetId, ids, onClose, onSelect }: { assetId: string | null; ids: string[]; onClose: () => void; onSelect: (id: string) => void }) {
  const asset = useAsset(assetId ?? undefined);
  const genome = useProject((s) => s.genome);
  const addAsset = useProject((s) => s.addAsset);
  const removeAsset = useProject((s) => s.removeAsset);
  const parent = useAsset(asset?.parentId);
  const refs = useReferenceIds();
  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [busy, setBusy] = React.useState<Busy>(null);
  const [bgProgress, setBgProgress] = React.useState<{ label: string; value: number } | null>(null);
  const [editPrompt, setEditPrompt] = React.useState("");
  const [editProvider, setEditProvider] = React.useState<ProviderChoice>("auto");
  const [editBrand, setEditBrand] = React.useState(true);
  const [failure, setFailure] = React.useState<{ summary: string; attempts: AttemptInfo[] } | null>(null);
  const currentIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    currentIdRef.current = assetId;
  }, [assetId]);

  const idx = assetId ? ids.indexOf(assetId) : -1;
  const prevId = idx > 0 ? ids[idx - 1] : null;
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  const go = React.useCallback(
    (id: string) => {
      setMode("view");
      setFailure(null);
      onSelect(id);
    },
    [onSelect],
  );
  const close = () => {
    if (busy) toast.message("Still working — the result will land in the Gallery when it finishes.");
    setMode("view");
    setFailure(null);
    onClose();
  };

  React.useEffect(() => {
    if (!assetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && prevId) go(prevId);
      if (e.key === "ArrowRight" && nextId) go(nextId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assetId, prevId, nextId, go]);

  const isRef = asset ? refs.includes(asset.id) : false;
  const purpose = asset ? purposeFromTags(asset.tags) : null;
  const purposeTags = purpose ? [purpose] : [];

  const toggleRef = () => asset && setStyleReferences([asset.id], !isRef);
  const download = () => asset && downloadBlob(asset.blob, asset.name);
  const copyPrompt = async () => {
    if (!asset?.prompt) return;
    try {
      await navigator.clipboard.writeText(asset.prompt);
      toast.success("Prompt copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const del = async () => {
    if (!asset || busy) return;
    if (!confirm(`Delete “${asset.name}”? This cannot be undone.`)) return;
    const target = nextId ?? prevId;
    if (isRef) setStyleReferences([asset.id], false);
    await removeAsset(asset.id);
    toast.success("Image deleted");
    if (target) go(target);
    else close();
  };

  const removeBg = async () => {
    if (!asset || busy) return;
    setBusy("background");
    setFailure(null);
    setBgProgress({ label: "Loading the segmentation model…", value: 0 });
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const out = await removeBackground(asset.blob, {
        device: "cpu",
        model: "isnet_quint8",
        output: { format: "image/png" },
        progress: (key, current, total) => {
          const label = key.startsWith("fetch:") ? `Downloading ${key.slice(6).split("/").pop() ?? "model"}` : key.startsWith("compute:") ? "Segmenting…" : key;
          setBgProgress({ label, value: total > 0 ? (current / total) * 100 : 0 });
        },
      });
      const { width, height } = await readImageSize(out);
      const saved = await addAsset({
        kind: "image",
        name: deriveAssetName(asset.name, "cutout"),
        mime: "image/png",
        blob: out,
        width,
        height,
        prompt: asset.prompt,
        provider: "imgly",
        model: "isnet_quint8",
        seed: asset.seed,
        stage: "imagery",
        tags: [...purposeTags, "cutout"],
        parentId: asset.id,
      });
      toast.success("Background removed", { description: "Saved as a new transparent PNG." });
      if (currentIdRef.current === asset.id) go(saved.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Background removal failed", {
        description: `${msg}. The model (~40 MB) is fetched from img.ly's CDN on first use, so this needs internet access.`,
      });
    } finally {
      setBusy(null);
      setBgProgress(null);
    }
  };

  const runEdit = async () => {
    if (!asset || busy) return;
    const instruction = editPrompt.trim();
    if (!instruction) {
      toast.error("Describe the change first");
      return;
    }
    setBusy("edit");
    setFailure(null);
    try {
      const inputImage = await blobToDataUrlResized(asset.blob, 1024);
      const prompt = editBrand && genome ? compilePrompt({ genome, subject: instruction, purpose: "custom" }).prompt : instruction;
      const { width, height } = fitSizeForApi(asset.width, asset.height);
      const { image } = await generateImage({ prompt, inputImage, provider: editProvider, width, height, purpose: "edit" });
      const saved = await addAsset({
        kind: "image",
        name: deriveAssetName(asset.name, "edit", extForMime(image.mime)),
        mime: image.mime,
        blob: dataUrlToBlob(image.dataUrl),
        width: image.width,
        height: image.height,
        prompt: instruction,
        provider: image.provider,
        model: image.model,
        seed: image.seed,
        stage: "imagery",
        tags: [...purposeTags, "ai", "edit"],
        parentId: asset.id,
      });
      markImageryInProgress();
      toast.success(`Edited with ${image.provider}`);
      setEditPrompt("");
      if (currentIdRef.current === asset.id) go(saved.id);
    } catch (e) {
      const parsed = parseAttemptsFromError(e instanceof Error ? e.message : String(e));
      setFailure(parsed);
      toast.error(parsed.summary);
    } finally {
      setBusy(null);
    }
  };

  const variation = async () => {
    if (!asset || busy || !asset.prompt) return;
    setBusy("variation");
    setFailure(null);
    try {
      const { width, height } = fitSizeForApi(asset.width, asset.height);
      const seed = randomSeed();
      const { image } = await generateImage({ prompt: asset.prompt, width, height, seed, provider: "auto", purpose: purpose ?? "custom" });
      const saved = await addAsset({
        kind: "image",
        name: deriveAssetName(asset.name.replace(/-\d+(?=\.[a-z0-9]+$)/i, ""), `v${image.seed ?? seed}`, extForMime(image.mime)),
        mime: image.mime,
        blob: dataUrlToBlob(image.dataUrl),
        width: image.width,
        height: image.height,
        prompt: asset.prompt,
        provider: image.provider,
        model: image.model,
        seed: image.seed ?? seed,
        stage: "imagery",
        tags: [...purposeTags, "ai", "variation"],
        parentId: asset.id,
      });
      markImageryInProgress();
      toast.success(`Variation from ${image.provider}`);
      if (currentIdRef.current === asset.id) go(saved.id);
    } catch (e) {
      const parsed = parseAttemptsFromError(e instanceof Error ? e.message : String(e));
      setFailure(parsed);
      toast.error(parsed.summary);
    } finally {
      setBusy(null);
    }
  };

  const origin = asset ? originOf(asset) : null;
  const pLabel = asset ? purposeLabel(asset) : null;

  // Portalled to <body>: the shell's animated content wrapper would otherwise act as
  // the containing block for this fixed dialog and clip it to the main column.
  if (!asset) return null;
  return createPortal(
    <Dialog
      open
      onClose={close}
      wide
      className="max-w-6xl"
      title={asset.name}
      description={`${asset.width ?? "?"}×${asset.height ?? "?"} px · ${formatBytes(asset.blob.size)} · ${asset.mime.replace("image/", "")}`}
    >
      {asset && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="relative checker rounded-md border border-line overflow-hidden flex items-center justify-center min-h-[280px] max-h-[64vh]">
            <AssetImage asset={asset} className="max-h-[64vh] max-w-full object-contain" />
            {prevId && (
              <Button variant="secondary" size="icon" onClick={() => go(prevId)} title="Previous (←)" className="absolute left-2 top-1/2 -translate-y-1/2">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {nextId && (
              <Button variant="secondary" size="icon" onClick={() => go(nextId)} title="Next (→)" className="absolute right-2 top-1/2 -translate-y-1/2">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {busy && (
              <div className="absolute inset-0 bg-bg/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-sm text-fg">
                <Spinner />
                {BUSY_LABEL[busy]}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-wrap gap-1">
              {pLabel && <Badge tone="accent">{pLabel}</Badge>}
              {origin && <Badge>{origin}</Badge>}
              {asset.stage !== "imagery" && <Badge tone="info">{asset.stage} stage</Badge>}
              {isRef && (
                <Badge tone="success">
                  <Star className="h-3 w-3 fill-current" /> style reference
                </Badge>
              )}
            </div>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt className="text-fg-subtle">Provider</dt>
              <dd className="font-mono truncate">{asset.provider ?? "—"}</dd>
              <dt className="text-fg-subtle">Model</dt>
              <dd className="font-mono truncate" title={asset.model}>
                {asset.model ?? "—"}
              </dd>
              <dt className="text-fg-subtle">Seed</dt>
              <dd className="font-mono">{asset.seed ?? "—"}</dd>
              <dt className="text-fg-subtle">Created</dt>
              <dd>{new Date(asset.createdAt).toLocaleString()}</dd>
              {parent && (
                <>
                  <dt className="text-fg-subtle">Derived from</dt>
                  <dd className="truncate">
                    <button type="button" className="text-accent hover:underline cursor-pointer truncate max-w-full" onClick={() => go(parent.id)} title={parent.name}>
                      {parent.name}
                    </button>
                  </dd>
                </>
              )}
            </dl>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="label">Prompt</div>
                {asset.prompt && (
                  <Button variant="ghost" size="icon-sm" onClick={copyPrompt} title="Copy prompt">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="inset p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-36 overflow-y-auto text-fg-muted">
                {asset.prompt || "No prompt stored — this image was uploaded."}
              </div>
            </div>

            {mode === "view" ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant={isRef ? "primary" : "secondary"} size="sm" onClick={toggleRef} title={isRef ? "Remove from style references" : "Pin as a style reference"}>
                  <Star className={cn("h-3.5 w-3.5", isRef && "fill-current")} /> {isRef ? "Reference" : "Set as reference"}
                </Button>
                <Button variant="secondary" size="sm" onClick={removeBg} disabled={Boolean(busy) || asset.kind === "svg"} loading={busy === "background"} title="Cut out the subject (runs in your browser)">
                  <Scissors className="h-3.5 w-3.5" /> Remove background
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMode("edit")} disabled={Boolean(busy)} title="Change the image with an instruction">
                  <WandSparkles className="h-3.5 w-3.5" /> Edit with prompt
                </Button>
                <Button variant="secondary" size="sm" onClick={variation} disabled={Boolean(busy) || !asset.prompt} loading={busy === "variation"} title={asset.prompt ? "Same prompt, new seed" : "No prompt stored for this image"}>
                  <Shuffle className="h-3.5 w-3.5" /> Variation
                </Button>
                <Button variant="secondary" size="sm" onClick={download} title="Download the original file">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button variant="outline" size="sm" onClick={del} disabled={Boolean(busy)} className="text-danger border-danger/40 hover:bg-danger/10" title="Delete this image">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            ) : (
              <div className="surface-2 p-3 flex flex-col gap-3">
                <div className="label">Edit with a prompt</div>
                <Textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={3} placeholder="e.g. make it dusk, add light fog, keep the composition" aria-label="Edit instruction" />
                <Switch checked={editBrand} onChange={setEditBrand} label="Fold in the brand style" />
                <Field label="Provider">
                  <Select value={editProvider} onChange={(e) => setEditProvider(e.target.value as ProviderChoice)}>
                    {EDIT_PROVIDERS.map((id) => (
                      <option key={id} value={id}>
                        {PROVIDER_BY_ID[id].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-xs text-fg-muted">Only Pollinations and Gemini accept an input image; “Auto” skips the others.</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={runEdit} loading={busy === "edit"} disabled={!editPrompt.trim() || (busy !== null && busy !== "edit")}>
                    <WandSparkles className="h-3.5 w-3.5" /> Apply edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setMode("view")} disabled={busy === "edit"}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {bgProgress && (
              <div className="flex flex-col gap-1">
                <Progress value={bgProgress.value} />
                <div className="text-xs text-fg-muted truncate">{bgProgress.label}</div>
              </div>
            )}

            {failure && (
              <div className="inset p-2.5 flex flex-col gap-1.5">
                <div className="text-xs text-danger flex items-start gap-1.5">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-px" /> <span className="break-words min-w-0">{failure.summary}</span>
                </div>
                <AttemptList attempts={failure.attempts} />
              </div>
            )}

            {idx >= 0 && ids.length > 1 && (
              <div className="text-[11px] text-fg-subtle">
                {idx + 1} of {ids.length} · use ← → to browse
              </div>
            )}
          </aside>
        </div>
      )}
    </Dialog>,
    document.body,
  );
}

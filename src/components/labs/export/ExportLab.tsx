"use client";
import * as React from "react";
import Link from "next/link";
import { Archive, BookOpen, Check, Circle, CircleDashed, Clapperboard, Compass, Copy, Download, FileJson, FileText, Image as ImageIcon, Layers, PackageOpen, Palette, PenTool, RefreshCw, Share2, Type, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, PageHeader, Progress, SectionHeader, Spinner, Switch } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { STAGES } from "@/lib/genome/stages";
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { exportProjectBundle } from "@/lib/export/bundle";
import { buildKitFiles, DEFAULT_KIT_OPTIONS, filterKitFiles, KIT_GROUPS, kitFilename, summarizeKit, zipKitFiles, type KitFile, type KitGroupId, type KitProgress } from "@/lib/export/kit";
import { developerReadme, identitySummary } from "@/lib/export/handoff";
import { SOCIAL_SPECS } from "@/lib/export/social";
import { cn, downloadBlob, formatBytes, slugify } from "@/lib/utils";
import { TokensPanel } from "./TokensPanel";
import { SocialKitPanel, type SocialPreview } from "./SocialKitPanel";

const ICONS = { FileText, Compass, PenTool, Palette, Type, Image: ImageIcon, Clapperboard, Layers, BookOpen, PackageOpen } as const;

interface KitState {
  files: KitFile[] | null;
  building: boolean;
  progress: KitProgress | null;
  error: string | null;
  previews: Record<string, SocialPreview>;
}

const IDLE: KitState = { files: null, building: false, progress: null, error: null, previews: {} };

function previewsFrom(files: KitFile[]): Record<string, SocialPreview> {
  const out: Record<string, SocialPreview> = {};
  for (const spec of SOCIAL_SPECS) {
    const f = files.find((x) => x.path === `social/${spec.file}`);
    if (f && f.data instanceof Blob) out[spec.id] = { url: URL.createObjectURL(f.data), blob: f.data };
  }
  return out;
}

/** What the kit depends on — stage status, history and timestamps are deliberately left out so toggling a stage does not rebuild. */
function kitFingerprint(genome: Genome | null, assets: Asset[]): string {
  if (!genome) return "";
  return JSON.stringify([genome.name, genome.brief, genome.strategy, genome.visual, genome.notes, assets.map((a) => [a.id, a.blob.size, a.stage])]);
}

/** Builds the full kit in the background whenever the Genome content or assets change, so counts, sizes and previews are live. */
function useKitBuild(genome: Genome | null, assets: Asset[]) {
  const [state, setState] = React.useState<KitState>(IDLE);
  const [nonce, setNonce] = React.useState(0);
  const builtKey = React.useRef<string | null>(null);
  const fingerprint = kitFingerprint(genome, assets);
  React.useEffect(() => {
    if (!genome) return;
    const key = `${fingerprint}#${nonce}`;
    if (builtKey.current === key) return;
    let cancelled = false;
    let previews: Record<string, SocialPreview> = {};
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, building: true, error: null, progress: { phase: "render", percent: 0, label: "Starting" } }));
      buildKitFiles(genome, assets, {}, (p) => {
        if (!cancelled) setState((s) => (s.progress?.percent === p.percent ? s : { ...s, progress: p }));
      })
        .then((files) => {
          if (cancelled) return;
          previews = previewsFrom(files);
          builtKey.current = key;
          setState({ files, building: false, progress: null, error: null, previews });
        })
        .catch((e) => {
          if (!cancelled) setState((s) => ({ ...s, building: false, progress: null, error: e instanceof Error ? e.message : String(e) }));
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      for (const p of Object.values(previews)) URL.revokeObjectURL(p.url);
    };
  }, [genome, assets, fingerprint, nonce]);
  const rebuild = React.useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, rebuild };
}

export function ExportLab() {
  const genome = useProject((s) => s.genome);
  const assets = useProject((s) => s.assets);
  const setStage = useProject((s) => s.setStage);
  const [include, setInclude] = React.useState<Record<KitGroupId, boolean>>(DEFAULT_KIT_OPTIONS.include);
  const [zipping, setZipping] = React.useState<KitProgress | null>(null);
  const [bundling, setBundling] = React.useState(false);
  const kit = useKitBuild(genome, assets);

  const summary = React.useMemo(() => (kit.files ? summarizeKit(kit.files) : null), [kit.files]);
  const selected = React.useMemo(() => (kit.files ? filterKitFiles(kit.files, { include }) : []), [kit.files, include]);
  const selectedBytes = selected.reduce((n, f) => n + f.bytes, 0);
  const readme = React.useMemo(() => (genome ? developerReadme(genome) : ""), [genome]);
  const shareSummary = React.useMemo(() => (genome ? identitySummary(genome) : ""), [genome]);

  if (!genome) return null;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard unavailable — use Download instead");
    }
  };

  const downloadKit = async () => {
    if (zipping) return;
    try {
      let files = kit.files;
      if (!files) {
        setZipping({ phase: "render", percent: 0, label: "Rendering" });
        files = await buildKitFiles(genome, assets, { include }, setZipping);
      }
      setZipping({ phase: "zip", percent: 0, label: "Packing" });
      const blob = await zipKitFiles(filterKitFiles(files, { include }), setZipping);
      downloadBlob(blob, kitFilename(genome));
      toast.success(`Brand kit downloaded · ${formatBytes(blob.size)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the kit");
    } finally {
      setZipping(null);
    }
  };

  const downloadBundle = async () => {
    setBundling(true);
    try {
      const blob = await exportProjectBundle(genome, assets);
      downloadBlob(blob, `${slugify(genome.name)}.ligature.zip`);
      toast.success("Project bundle downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bundle failed");
    } finally {
      setBundling(false);
    }
  };

  const downloadGenome = () => {
    downloadBlob(new Blob([JSON.stringify(genome, null, 2)], { type: "application/json" }), `${slugify(genome.name)}.genome.json`);
    toast.success("Genome JSON downloaded");
  };

  const exportDone = genome.stages.export === "done";
  const doneCount = STAGES.filter((s) => genome.stages[s.id] === "done").length;
  const placeholderLogo = !assets.some((a) => a.kind === "svg" && a.stage === "logo");

  return (
    <div className="@container flex flex-col gap-6">
      <PageHeader
        eyebrow="Stage 10"
        title="Export"
        description="The handoff hub: one zip with everything, tokens for engineers, a social kit, and the portable project bundle."
        actions={
          <>
            <Button variant={exportDone ? "secondary" : "outline"} size="sm" onClick={() => setStage("export", exportDone ? "in-progress" : "done")} title={exportDone ? "Reopen the export stage" : "Mark the export stage done"}>
              <Check className={cn("h-4 w-4", exportDone && "text-success")} /> {exportDone ? "Export done" : "Mark export done"}
            </Button>
            <Button size="sm" onClick={downloadKit} loading={Boolean(zipping)} title="Download the brand kit zip">
              <Download className="h-4 w-4" /> Download brand kit (.zip)
            </Button>
          </>
        }
      />

      {/* Stage completion */}
      <Card>
        <SectionHeader
          title="Programme status"
          description={doneCount === STAGES.length ? "Every stage is done — this identity is ready to hand over." : `${doneCount} of ${STAGES.length} stages done. Exports work at any point; incomplete stages fall back to placeholders.`}
          actions={<span className="text-xs font-mono text-fg-subtle">{Math.round((doneCount / STAGES.length) * 100)}%</span>}
        />
        <Progress value={(doneCount / STAGES.length) * 100} className="mb-4" />
        <div className="grid grid-cols-2 @lg:grid-cols-5 gap-2">
          {STAGES.map((s) => {
            const status = genome.stages[s.id] ?? "todo";
            const Icon = ICONS[s.icon];
            return (
              <Link key={s.id} href={`/studio/${genome.id}/${s.id}`} className="surface-2 px-3 py-2 flex items-center gap-2.5 text-sm hover:border-line-strong transition-colors min-w-0" title={`${s.label}: ${status}`}>
                <Icon className="h-4 w-4 text-fg-muted shrink-0" />
                <span className="flex-1 truncate">{s.label}</span>
                {status === "done" ? <Check className="h-3.5 w-3.5 text-success shrink-0" /> : status === "in-progress" ? <CircleDashed className="h-3.5 w-3.5 text-warning shrink-0" /> : <Circle className="h-3.5 w-3.5 text-fg-subtle shrink-0" />}
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        {/* Kit checklist */}
        <Card>
          <SectionHeader title="Brand kit" description="Choose what goes into the zip. README.md and genome.json are always included." />
          {placeholderLogo ? (
            <div className="text-xs text-fg-muted mb-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span>
                No logo artwork yet — logo, favicon and social files use generated placeholders (noted in the README).{" "}
                <Link href={`/studio/${genome.id}/logo`} className="text-accent hover:underline">
                  Open the Logo lab
                </Link>
              </span>
            </div>
          ) : null}
          <ul className="flex flex-col">
            {KIT_GROUPS.map((g) => {
              const s = summary?.[g.id];
              const on = include[g.id];
              return (
                <li key={g.id} className={cn("flex items-center gap-3 py-2.5 border-t border-line", !on && "opacity-60")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap [&_button>span:last-child]:text-fg [&_button>span:last-child]:font-medium">
                      <Switch checked={on} onChange={(v) => setInclude((prev) => ({ ...prev, [g.id]: v }))} label={g.label} />
                      <span className="font-mono text-[11px] text-fg-subtle">{g.folder}</span>
                    </div>
                    <div className="text-xs text-fg-muted pl-11">{g.description}</div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-fg-muted whitespace-nowrap min-w-[92px]">
                    {kit.building && !s ? <span className="shimmer inline-block h-3 w-16 rounded" /> : s ? `${s.count} ${s.count === 1 ? "file" : "files"} · ${formatBytes(s.bytes)}` : kit.files ? "empty" : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line pt-3 mt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-fg-muted">
              {kit.building ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> {kit.progress ? `Rendering ${kit.progress.percent}% · ${kit.progress.label}` : "Rendering…"}
                </span>
              ) : kit.error ? (
                <span className="text-danger">Kit build failed: {kit.error}</span>
              ) : kit.files ? (
                <span>
                  <strong className="text-fg">{selected.length} files · {formatBytes(selectedBytes)}</strong> selected of {kit.files.length} · {formatBytes(kit.files.reduce((n, f) => n + f.bytes, 0))} uncompressed
                </span>
              ) : (
                "Preparing…"
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" onClick={kit.rebuild} disabled={kit.building} title="Rebuild the kit" aria-label="Rebuild the kit">
                <RefreshCw className={cn("h-4 w-4", kit.building && "animate-[spin_1s_linear_infinite]")} />
              </Button>
              <Button size="sm" onClick={downloadKit} loading={Boolean(zipping)} title="Download the brand kit zip">
                <Download className="h-4 w-4" /> Download brand kit (.zip)
              </Button>
            </div>
          </div>
          {zipping ? (
            <div className="mt-3">
              <Progress value={zipping.percent} />
              <div className="text-[11px] text-fg-subtle mt-1 font-mono truncate">
                {zipping.phase === "zip" ? "Packing" : "Rendering"} {zipping.percent}% · {zipping.label}
              </div>
            </div>
          ) : null}
        </Card>

        {/* Developer handoff */}
        <Card className="min-w-0">
          <SectionHeader
            title="Developer handoff"
            description="A README snippet with the palette table, fonts and usage rules."
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={() => copy(readme, "README")} title="Copy the Markdown">
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => downloadBlob(new Blob([readme], { type: "text/markdown;charset=utf-8" }), `${slugify(genome.name)}-brand-readme.md`)} title="Download README.md" aria-label="Download README.md">
                  <Download className="h-4 w-4" />
                </Button>
              </>
            }
          />
          <pre className="inset p-3 font-mono text-[12px] leading-relaxed max-h-[420px] overflow-auto whitespace-pre-wrap break-words" aria-label="README preview">
            {readme}
          </pre>
        </Card>
      </div>

      <TokensPanel genome={genome} onCopy={copy} />

      <SocialKitPanel brandSlug={genome.name} previews={kit.previews} building={kit.building} />

      <div className="grid gap-6 @4xl:grid-cols-2 items-start">
        <Card>
          <SectionHeader title="Project files" description="The lossless forms of this project — reopen or share them with anyone running Ligature." />
          <div className="flex flex-col gap-2">
            <div className="surface-2 px-4 py-3 flex items-center gap-3">
              <Archive className="h-4 w-4 text-fg-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Project bundle</div>
                <div className="text-xs text-fg-muted">
                  Genome + every asset ({assets.length}) as <span className="font-mono">{slugify(genome.name)}.ligature.zip</span>. Import it from the dashboard.
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadBundle} loading={bundling}>
                <Download className="h-4 w-4" /> Bundle
              </Button>
            </div>
            <div className="surface-2 px-4 py-3 flex items-center gap-3">
              <FileJson className="h-4 w-4 text-fg-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Genome JSON</div>
                <div className="text-xs text-fg-muted">The Brand Genome alone — small, diffable, versionable in git.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadGenome}>
                <Download className="h-4 w-4" /> JSON
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Share summary"
            description="One paragraph that describes the identity — for an email, a deck note or a project page."
            actions={
              <Button variant="secondary" size="sm" onClick={() => copy(shareSummary, "Summary")} title="Copy the summary">
                <Share2 className="h-4 w-4" /> Copy
              </Button>
            }
          />
          <p className="text-sm leading-relaxed text-fg">{shareSummary}</p>
        </Card>
      </div>
    </div>
  );
}


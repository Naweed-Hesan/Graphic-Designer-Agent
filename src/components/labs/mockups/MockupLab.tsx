"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Download, ImagePlus, PenTool, Presentation } from "lucide-react";
import { Button, PageHeader, Progress } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import { downloadBlob, slugify } from "@/lib/utils";
import { DEFAULT_OPTIONS, MOCKUP_TEMPLATES, TEMPLATE_BY_ID, type SceneOptions } from "@/lib/mockups/templates";
import { buildScene, renderAll } from "@/lib/mockups/render";
import { useMockupScene } from "./useMockupScene";
import { TemplateGallery } from "./TemplateGallery";
import { MockupPreview } from "./MockupPreview";
import { PresentationDialog } from "./PresentationDialog";
import { SavedMockups } from "./SavedMockups";

const STAGE = STAGE_BY_ID.mockups;

export function MockupLab() {
  const genome = useProject((s) => s.genome);
  const addAsset = useProject((s) => s.addAsset);
  const { prepared } = useMockupScene();
  const [selectedId, setSelectedId] = React.useState(MOCKUP_TEMPLATES[0].id);
  const [options, setOptions] = React.useState<SceneOptions>(DEFAULT_OPTIONS);
  const [presenting, setPresenting] = React.useState(false);
  const [progress, setProgress] = React.useState<{ kind: "zip" | "assets"; done: number; total: number; label: string } | null>(null);

  const template = TEMPLATE_BY_ID[selectedId] ?? MOCKUP_TEMPLATES[0];
  const scene = React.useMemo(() => (genome && prepared ? buildScene(genome, prepared, options, 1) : null), [genome, prepared, options]);
  const patchOptions = (patch: Partial<SceneOptions>) => setOptions((o) => ({ ...o, ...patch }));

  const exportAll = async () => {
    if (!scene || !genome) return;
    setProgress({ kind: "zip", done: 0, total: MOCKUP_TEMPLATES.length, label: "" });
    try {
      const rendered = await renderAll(MOCKUP_TEMPLATES, scene, 2, (done, total, t) => setProgress({ kind: "zip", done, total, label: t.name }));
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const base = `${slugify(genome.name)}-mockups`;
      const folder = zip.folder(base)!;
      for (const r of rendered) folder.file(`${r.template.category}-${r.template.id}.png`, r.blob);
      folder.file(
        "README.txt",
        `${genome.name} — brand mockups\n\nRendered by Ligature at 2× from the Brand Genome.\n${rendered.map((r) => `${r.template.category}-${r.template.id}.png  ${r.width}×${r.height}  ${r.template.name}`).join("\n")}\n`,
      );
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${base}.zip`);
      toast.success(`Exported ${rendered.length} mockups`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setProgress(null);
    }
  };

  const saveAll = async () => {
    if (!scene || !genome) return;
    setProgress({ kind: "assets", done: 0, total: MOCKUP_TEMPLATES.length, label: "" });
    try {
      const rendered = await renderAll(MOCKUP_TEMPLATES, scene, 2, (done, total, t) => setProgress({ kind: "assets", done, total, label: t.name }));
      for (const r of rendered) {
        await addAsset({ kind: "image", name: `${r.template.name} — ${genome.name}`, mime: "image/png", blob: r.blob, width: r.width, height: r.height, stage: "mockups", tags: ["mockup", r.template.id, r.template.category] });
      }
      toast.success(`Saved ${rendered.length} mockups to assets`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save assets");
    } finally {
      setProgress(null);
    }
  };

  if (!genome) return null;
  const palette = genome.visual.palette.colors;
  const busy = !!progress;

  return (
    <div>
      <PageHeader
        eyebrow={`Stage ${STAGE.short}`}
        title={STAGE.label}
        description="Procedural scenes drawn from the Brand Genome — no stock photos, always in sync with your palette, type and logo."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPresenting(true)} disabled={!scene} title="Client presentation board">
              <Presentation className="h-4 w-4" /> Presentation
            </Button>
            <Button variant="secondary" size="sm" onClick={saveAll} disabled={!scene || busy} loading={progress?.kind === "assets"} title="Render every template and save to the project assets">
              <ImagePlus className="h-4 w-4" /> Save all to assets
            </Button>
            <Button size="sm" onClick={exportAll} disabled={!scene || busy} loading={progress?.kind === "zip"} title="Render every template at 2× into a zip">
              <Download className="h-4 w-4" /> Export all (zip)
            </Button>
          </>
        }
      />

      {prepared?.logos.placeholder && (
        <div className="surface-2 flex flex-wrap items-center gap-3 px-4 py-3 mb-5 text-sm">
          <PenTool className="h-4 w-4 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">No logo yet.</span> <span className="text-fg-muted">Mockups use a generated placeholder mark built from the brand initials. Finish the Logo lab and they update automatically.</span>
          </div>
          <Link href={`/studio/${genome.id}/logo`} className="inline-flex items-center gap-1 text-accent font-medium hover:underline underline-offset-4">
            Go to Logo lab <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {progress && (
        <div className="surface px-4 py-3 mb-5">
          <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
            <span>
              {progress.kind === "zip" ? "Rendering for export" : "Rendering and saving"}
              {progress.label ? ` — ${progress.label}` : ""}
            </span>
            <span className="font-mono">
              {progress.done}/{progress.total}
            </span>
          </div>
          <Progress value={(progress.done / progress.total) * 100} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)] gap-6 items-start">
        <aside className="lg:sticky lg:top-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-1 -mr-1">
          <TemplateGallery scene={scene} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <section className="min-w-0">
          <MockupPreview template={template} scene={scene} options={options} onOptions={patchOptions} palette={palette} />
        </section>
      </div>

      <SavedMockups />
      {presenting && <PresentationDialog open onClose={() => setPresenting(false)} scene={scene} />}
    </div>
  );
}

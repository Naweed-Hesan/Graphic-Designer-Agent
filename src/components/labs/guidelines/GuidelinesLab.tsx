"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BookOpen, Check, Copy, Download, FileText, PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, PageHeader, Tabs, Textarea, EmptyState } from "@/components/ui";
import { useProject, assetUrl } from "@/lib/store/project";
import { buildGuidelines, tableOfContents } from "@/lib/guidelines/model";
import { guidelinesCss, renderMarkdown, renderStandaloneHtml, PAGE_SIZES, type PageSize } from "@/lib/guidelines/html";
import { blobToDataUrl, cn, downloadBlob, slugify } from "@/lib/utils";
import { GuidelinesDocument } from "./GuidelinesDocument";

/**
 * Print rules for the studio: the shell already hides itself with `.no-print`;
 * these unclip the scroll containers so the whole document paginates, and hide
 * the lab chrome around the document.
 */
const STUDIO_PRINT_CSS = `
@media print {
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; display: block !important; }
  body > script { display: none !important; }
  .h-screen { display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  .h-screen > *:not(:has(main)) { display: none !important; }
  .h-screen > *:has(main), .h-screen > * > *:has(main), main, main > * {
    display: block !important; height: auto !important; min-height: 0 !important; max-width: none !important;
    overflow: visible !important; padding: 0 !important; margin: 0 !important; animation: none !important;
  }
  .gl-shell-hide { display: none !important; }
  .gl-viewer { display: block !important; }
  .gl-paper { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; overflow: visible !important; }
}
`;

export function GuidelinesLab() {
  const genome = useProject((s) => s.genome);
  const assets = useProject((s) => s.assets);
  const update = useProject((s) => s.update);
  const [pageSize, setPageSize] = React.useState<PageSize>("A4");
  const [activeId, setActiveId] = React.useState<string>("");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState<"html" | "md" | null>(null);
  const docRef = React.useRef<HTMLDivElement>(null);

  const doc = React.useMemo(() => (genome ? buildGuidelines(genome, assets, { assetUrl }) : null), [genome, assets]);
  const css = React.useMemo(() => (doc ? guidelinesCss(doc, { pageSize }) : ""), [doc, pageSize]);
  const toc = React.useMemo(() => (doc ? tableOfContents(doc) : []), [doc]);

  // Scroll-spy: highlight the section nearest the top of the viewport.
  const sectionCount = doc?.sections.length ?? 0;
  React.useEffect(() => {
    const root = docRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("section[id^='gl-']"));
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^gl-/, "");
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        if (!visible.size) return;
        const best = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
        setActiveId(best);
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: [0, 0.1, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [sectionCount]);

  if (!genome || !doc) return null;

  const jumpTo = (id: string) => {
    document.getElementById(`gl-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const print = () => {
    const prev = document.title;
    document.title = `${genome.name} — Brand guidelines`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const downloadHtml = async () => {
    setBusy("html");
    try {
      const html = await renderStandaloneHtml(doc, {
        inlineAssets: true,
        pageSize,
        resolveAsset: async (ref) => {
          const a = assets.find((x) => x.id === ref.assetId);
          return a ? blobToDataUrl(a.blob) : undefined;
        },
      });
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slugify(genome.name)}-brand-guidelines.html`);
      toast.success("Guidelines HTML downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the HTML");
    } finally {
      setBusy(null);
    }
  };

  const copyMarkdown = async () => {
    setBusy("md");
    try {
      await navigator.clipboard.writeText(renderMarkdown(doc));
      toast.success("Markdown copied to clipboard");
    } catch {
      downloadBlob(new Blob([renderMarkdown(doc)], { type: "text/markdown" }), `${slugify(genome.name)}-brand-guidelines.md`);
      toast.message("Clipboard unavailable — downloaded the Markdown instead");
    } finally {
      setBusy(null);
    }
  };

  const openEditor = () => {
    setDraft(genome.notes);
    setEditing(true);
  };
  const saveIntro = () => {
    const next = draft.trim();
    update(
      (g) => {
        g.notes = next;
      },
      { summary: next ? "Edited the guidelines introduction" : "Reset the guidelines introduction", stage: "guidelines" },
    );
    setEditing(false);
    toast.success(next ? "Introduction updated" : "Introduction reset to the generated story");
  };

  const hasContent = doc.sections.length > 2;

  return (
    <div className="@container">
      <style>{css}</style>
      <style>{STUDIO_PRINT_CSS}</style>
      <div className="gl-shell-hide">
        <PageHeader
          eyebrow="Stage 09"
          title="Guidelines"
          description="A living brand book generated from the Genome — every edit elsewhere updates it. Print it, save it as PDF or hand over the standalone HTML."
          actions={
            <>
              <Tabs value={pageSize} onChange={setPageSize} items={(Object.keys(PAGE_SIZES) as PageSize[]).map((k) => ({ value: k, label: PAGE_SIZES[k].label }))} />
              <Button variant="secondary" size="sm" onClick={openEditor} title="Edit the introduction text">
                <PenLine className="h-4 w-4" /> Edit intro
              </Button>
              <Button variant="secondary" size="sm" onClick={copyMarkdown} loading={busy === "md"} title="Copy the document as Markdown">
                <Copy className="h-4 w-4" /> Copy Markdown
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadHtml} loading={busy === "html"} title="Download a self-contained HTML file">
                <Download className="h-4 w-4" /> Download HTML
              </Button>
              <Button size="sm" onClick={print} title="Print or save as PDF">
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </Button>
            </>
          }
        />
        {doc.missing.length ? <CompletenessBanner projectId={genome.id} items={doc.missing} /> : null}
      </div>

      {!hasContent ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="The guidelines will fill in as the Genome does"
          description="Complete the brief, strategy, colour and type stages and this document assembles itself."
          className="mb-6 gl-shell-hide"
        />
      ) : null}

      <div className="gl-viewer grid gap-6 @3xl:grid-cols-[200px_minmax(0,1fr)] items-start">
        <nav className="gl-shell-hide @3xl:sticky @3xl:top-2 flex @3xl:flex-col gap-0.5 overflow-x-auto @3xl:overflow-visible pb-1 @3xl:pb-0 -mx-1 px-1" aria-label="Contents">
          <div className="label mb-2 hidden @3xl:block">Contents</div>
          <button
            type="button"
            onClick={() => jumpTo("cover")}
            className={cn("text-left text-[13px] rounded-md px-2 py-1.5 transition-colors whitespace-nowrap @3xl:whitespace-normal cursor-pointer", activeId === "cover" ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg hover:bg-bg-elev-2")}
          >
            <span className="font-mono text-[10px] text-fg-subtle mr-2">—</span>Cover
          </button>
          {toc.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => jumpTo(t.id)}
              className={cn("text-left text-[13px] rounded-md px-2 py-1.5 transition-colors whitespace-nowrap @3xl:whitespace-normal cursor-pointer", activeId === t.id ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg hover:bg-bg-elev-2")}
            >
              <span className="font-mono text-[10px] text-fg-subtle mr-2">{t.number}</span>
              {t.title}
            </button>
          ))}
          <div className="hidden @3xl:block mt-4 pt-3 border-t border-line text-[11px] text-fg-subtle leading-relaxed">
            {PAGE_SIZES[pageSize].label} · {PAGE_SIZES[pageSize].note}
            <br />
            Version {doc.version} · {doc.date}
          </div>
        </nav>
        <div ref={docRef} className="gl-paper min-w-0 rounded-lg border border-line shadow-card overflow-hidden">
          <GuidelinesDocument doc={doc} />
        </div>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Introduction" description="This text opens the guidelines. Leave it empty to use the story composed from the positioning, mission and vision. Blank lines start new paragraphs.">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} placeholder={genome.strategy.positioning || "Tell the brand's story…"} aria-label="Introduction text" />
        <div className="flex items-center justify-between gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setDraft("")} disabled={!draft}>
            Use generated story
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveIntro}>
              <Check className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function CompletenessBanner({ projectId, items }: { projectId: string; items: { stage: string; stageLabel: string; message: string }[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? items : items.slice(0, 3);
  return (
    <div className="surface-2 border-warning/40 px-4 py-3 mb-6 flex gap-3 items-start">
      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {items.length === 1 ? "One thing is missing" : `${items.length} things are missing`} — the document adapts, but the client will notice.
        </div>
        <ul className="mt-1.5 flex flex-col gap-1">
          {shown.map((m, i) => (
            <li key={i} className="text-[13px] text-fg-muted flex flex-wrap items-baseline gap-x-2">
              <span>{m.message}</span>
              <Link href={`/studio/${projectId}/${m.stage}`} className="inline-flex items-center gap-0.5 text-accent hover:underline whitespace-nowrap">
                Open {m.stageLabel} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
        {items.length > 3 ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[12px] text-fg-subtle hover:text-fg cursor-pointer inline-flex items-center gap-1">
            <FileText className="h-3 w-3" /> {expanded ? "Show fewer" : `Show all ${items.length}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

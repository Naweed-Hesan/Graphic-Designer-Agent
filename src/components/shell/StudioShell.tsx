"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CircleDashed, FileText, Compass, PenTool, Palette, Type, Image as ImageIcon, Clapperboard, Layers, BookOpen, PackageOpen, Settings, MessageSquare, Download, PanelRightClose, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/ui";
import { LigatureMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { SettingsDialog } from "./SettingsDialog";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { useProject } from "@/lib/store/project";
import { useSettings } from "@/lib/store/settings";
import { STAGES, nextStage, prevStage } from "@/lib/genome/stages";
import type { StageId } from "@/lib/genome/schema";
import { cn, downloadBlob, slugify } from "@/lib/utils";
import { exportProjectBundle } from "@/lib/export/bundle";
import { ensureFont } from "@/lib/type/fonts";

const ICONS = { FileText, Compass, PenTool, Palette, Type, Image: ImageIcon, Clapperboard, Layers, BookOpen, PackageOpen } as const;

export function StudioShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { genome, loading, error, saving, load, unload } = useProject();
  const assistantOpen = useSettings((s) => s.assistantOpen);
  const setSettings = useSettings((s) => s.set);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const stage = (pathname.split("/")[3] || "brief") as StageId;

  React.useEffect(() => {
    load(projectId);
    return () => unload();
  }, [projectId, load, unload]);

  // Keep brand fonts loaded across every lab so previews are always accurate.
  const display = genome?.visual.typography.display;
  const body = genome?.visual.typography.body;
  const mono = genome?.visual.typography.mono;
  React.useEffect(() => {
    if (display) ensureFont(display.family, display.weights);
    if (body) ensureFont(body.family, body.weights);
    if (mono) ensureFont(mono.family, mono.weights);
  }, [display, body, mono]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setSettings({ assistantOpen: !useSettings.getState().assistantOpen });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const target = e.key === "ArrowRight" ? nextStage(stage) : prevStage(stage);
        if (target) router.push(`/studio/${projectId}/${target}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, projectId, router, setSettings]);

  const exportBundle = async () => {
    const { genome: g, assets } = useProject.getState();
    if (!g) return;
    toast.promise(
      exportProjectBundle(g, assets).then((blob) => downloadBlob(blob, `${slugify(g.name)}.ligature.zip`)),
      { loading: "Packing project…", success: "Project bundle downloaded", error: "Export failed" },
    );
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="surface p-8 max-w-md text-center">
          <div className="font-semibold mb-1">Project not found</div>
          <p className="text-sm text-fg-muted mb-4">{error}</p>
          <Link href="/" className="text-accent text-sm">Back to projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn("no-print shrink-0 border-r border-line bg-bg-elev flex flex-col transition-[width] duration-200", collapsed ? "w-14" : "w-60")}>
        <div className={cn("h-14 flex items-center border-b border-line", collapsed ? "justify-center" : "px-4 gap-2")}>
          <Link href="/" className="flex items-center gap-2 min-w-0" title="All projects">
            <LigatureMark size={24} />
            {!collapsed && <span className="font-semibold tracking-tight truncate">Ligature</span>}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {STAGES.map((s) => {
            const Icon = ICONS[s.icon];
            const status = genome?.stages[s.id] ?? "todo";
            const active = stage === s.id;
            return (
              <Link
                key={s.id}
                href={`/studio/${projectId}/${s.id}`}
                title={collapsed ? s.label : undefined}
                className={cn(
                  "relative flex items-center gap-3 mx-2 my-0.5 rounded-md px-2.5 h-9 text-sm transition-colors",
                  active ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg hover:bg-bg-elev-2",
                  collapsed && "justify-center px-0",
                )}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded bg-accent" />}
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{s.label}</span>
                    {status === "done" ? <Check className="h-3.5 w-3.5 text-success" /> : status === "in-progress" ? <CircleDashed className="h-3.5 w-3.5 text-warning" /> : <span className="text-[10px] text-fg-subtle font-mono">{s.short}</span>}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={cn("border-t border-line p-2 flex", collapsed ? "flex-col items-center gap-1" : "items-center justify-between")}>
          <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          {!collapsed && <ThemeToggle />}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print h-14 shrink-0 border-b border-line bg-bg-elev/70 backdrop-blur flex items-center gap-3 px-4">
          <ProjectName />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-fg-subtle mr-2 hidden md:inline">{saving ? "Saving…" : "Saved locally"}</span>
            <Button variant="ghost" size="sm" onClick={exportBundle} title="Download project bundle (.ligature.zip)">
              <Download className="h-4 w-4" /> <span className="hidden md:inline">Bundle</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="Providers & settings (⌘,)">
              <Settings className="h-4 w-4" /> <span className="hidden md:inline">Providers</span>
            </Button>
            <Button variant={assistantOpen ? "secondary" : "primary"} size="sm" onClick={() => setSettings({ assistantOpen: !assistantOpen })} title="Toggle Creative Director (⌘J)">
              {assistantOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />} <span className="hidden md:inline">Director</span>
            </Button>
          </div>
        </header>
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-6 animate-in" key={stage}>
              {loading || !genome ? (
                <div className="flex items-center gap-2 text-fg-muted h-64 justify-center">
                  <Spinner /> Loading project…
                </div>
              ) : (
                children
              )}
            </div>
            {genome && <StageFooter projectId={projectId} stage={stage} />}
          </main>
          {assistantOpen && (
            <aside className="no-print w-[400px] shrink-0 border-l border-line bg-bg-elev flex flex-col min-h-0 hidden lg:flex">
              <AssistantPanel stage={stage} />
            </aside>
          )}
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* Mobile assistant */}
      {assistantOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-bg flex flex-col">
          <AssistantPanel stage={stage} onClose={() => setSettings({ assistantOpen: false })} />
        </div>
      )}
      <button className="lg:hidden fixed bottom-4 right-4 z-30 rounded-full bg-accent text-accent-fg p-3 shadow-card" onClick={() => setSettings({ assistantOpen: true })} aria-label="Open Creative Director">
        <MessageSquare className="h-5 w-5" />
      </button>
    </div>
  );
}

function ProjectName() {
  const name = useProject((s) => s.genome?.name ?? "");
  const update = useProject((s) => s.update);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(name);
  if (!name) return <div className="h-5 w-40 shimmer rounded" />;
  if (editing)
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== name) update((g) => void (g.name = draft.trim()), { summary: `Renamed to ${draft.trim()}` });
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="bg-transparent font-semibold text-base outline-none border-b border-accent"
      />
    );
  return (
    <button
      className="font-semibold text-base hover:text-accent truncate max-w-[40vw] text-left cursor-text"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      title="Rename"
    >
      {name}
    </button>
  );
}

function StageFooter({ projectId, stage }: { projectId: string; stage: StageId }) {
  const status = useProject((s) => s.genome?.stages[stage] ?? "todo");
  const setStage = useProject((s) => s.setStage);
  const prev = prevStage(stage);
  const next = nextStage(stage);
  return (
    <div className="no-print mx-auto max-w-6xl px-6 pb-8 pt-2 flex items-center justify-between gap-3">
      <div>
        {prev && (
          <Link href={`/studio/${projectId}/${prev}`} className="text-sm text-fg-muted hover:text-fg inline-flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> {STAGES.find((s) => s.id === prev)?.label}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant={status === "done" ? "secondary" : "outline"} size="sm" onClick={() => setStage(stage, status === "done" ? "in-progress" : "done")}>
          <Check className={cn("h-4 w-4", status === "done" && "text-success")} /> {status === "done" ? "Marked done" : "Mark stage done"}
        </Button>
        {next && (
          <Link href={`/studio/${projectId}/${next}`}>
            <Button size="sm">
              Next: {STAGES.find((s) => s.id === next)?.label} <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

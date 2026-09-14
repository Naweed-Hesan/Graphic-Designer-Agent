"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Upload, Sparkles, Trash2, ArrowRight, Code2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Dialog, Badge, EmptyState, Field } from "@/components/ui";
import { Wordmark } from "./Logo";
import { createGenome, createSampleGenome } from "@/lib/genome/defaults";
import { safeParseGenome } from "@/lib/genome/schema";
import { STAGES } from "@/lib/genome/stages";
import { deleteProject, listProjects, saveProject, type ProjectRow } from "@/lib/db";
import { timeAgo, uid } from "@/lib/utils";
import { importBrandBundle } from "@/lib/export/bundle";
import { SettingsDialog } from "./SettingsDialog";
import { ThemeToggle } from "./ThemeToggle";

export function ProjectsDashboard() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectRow[] | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => setProjects(await listProjects()), []);
  React.useEffect(() => {
    let alive = true;
    listProjects().then((rows) => alive && setProjects(rows));
    return () => {
      alive = false;
    };
  }, []);

  const create = async (sample = false) => {
    const g = sample ? createSampleGenome() : createGenome(name.trim() || "Untitled brand");
    if (sample) g.id = uid(10);
    await saveProject(g);
    router.push(`/studio/${g.id}/brief`);
  };

  const onImport = async (file: File) => {
    try {
      if (file.name.endsWith(".zip")) {
        const id = await importBrandBundle(file);
        toast.success("Brand kit imported");
        router.push(`/studio/${id}/brief`);
        return;
      }
      const text = await file.text();
      const parsed = safeParseGenome(JSON.parse(text));
      if (!parsed.ok) throw new Error(parsed.error);
      const g = parsed.genome;
      g.id = uid(10);
      await saveProject(g);
      toast.success("Genome imported");
      router.push(`/studio/${g.id}/brief`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-1">
            <a href="https://github.com/Naweed-Hesan/Graphic-Designer-Agent" target="_blank" rel="noreferrer" className="text-fg-muted hover:text-fg p-2 rounded-md" title="GitHub">
              <Code2 className="h-4 w-4" />
            </a>
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              Providers
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="mb-12 max-w-3xl">
          <div className="label mb-3">Open-source brand identity studio</div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
            One Brand Genome. <em className="text-accent not-italic">Every</em> stage of identity design.
          </h1>
          <p className="mt-5 text-lg text-fg-muted leading-relaxed">
            Brief, strategy, logo, color, type, imagery, motion, mockups, guidelines and exports — in one place, driven by a single source of truth
            and free AI providers. Local-first: your work stays in your browser.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New brand
            </Button>
            <Button size="lg" variant="secondary" onClick={() => create(true)}>
              <Sparkles className="h-4 w-4" /> Open the sample project
            </Button>
            <Button size="lg" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import genome or kit
            </Button>
            <input ref={fileRef} type="file" accept=".json,.zip" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projects</h2>
            {projects?.length ? <span className="text-sm text-fg-subtle">{projects.length} in this browser</span> : null}
          </div>
          {projects === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="surface h-40 shimmer" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="No projects yet"
              description="Start a new brand or open the sample project to see every lab populated."
              action={<Button onClick={() => create(true)}>Open sample project</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const done = STAGES.filter((s) => p.genome.stages?.[s.id] === "done").length;
                const colors = p.genome.visual?.palette?.colors ?? [];
                return (
                  <div key={p.id} className="surface p-5 flex flex-col gap-4 group hover:border-line-strong transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/studio/${p.id}/brief`} className="font-semibold text-base hover:text-accent truncate block">
                          {p.name}
                        </Link>
                        <div className="text-xs text-fg-subtle mt-0.5">
                          {p.genome.brief?.industry || "No industry yet"} · edited {timeAgo(p.updatedAt)}
                        </div>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 text-fg-subtle hover:text-danger p-1 rounded-md transition-opacity cursor-pointer"
                        title="Delete project"
                        onClick={async () => {
                          if (!confirm(`Delete "${p.name}" and all its assets? This cannot be undone.`)) return;
                          await deleteProject(p.id);
                          refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex h-8 rounded-md overflow-hidden border border-line">
                      {colors.length ? (
                        colors.map((c) => <div key={c.id} className="flex-1" style={{ background: c.hex }} title={`${c.name} ${c.hex}`} />)
                      ) : (
                        <div className="flex-1 grid-dots" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge tone={done === STAGES.length ? "success" : "neutral"}>
                        {done}/{STAGES.length} stages
                      </Badge>
                      <Link href={`/studio/${p.id}/brief`} className="text-sm text-accent inline-flex items-center gap-1">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ["Brand Genome", "A versioned, machine-readable brand spec. Every lab reads from it; every export derives from it; the AI edits it through typed tools."],
            ["Prompt Compiler", "Palette, imagery style, personality and constraints are compiled into every image and video prompt, so nothing drifts off-brand."],
            ["Free by design", "Pollinations, Cloudflare Workers AI, Gemini and Hugging Face Spaces for media; the Claude Agent SDK on your own login for the Creative Director."],
          ].map(([t, d]) => (
            <div key={t} className="surface p-5">
              <div className="font-semibold mb-1">{t}</div>
              <p className="text-sm text-fg-muted leading-relaxed">{d}</p>
            </div>
          ))}
        </section>
      </main>

      <Dialog open={creating} onClose={() => setCreating(false)} title="New brand" description="You can rename it later. Everything is stored locally in your browser.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create(false);
          }}
        >
          <Field label="Brand or project name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aurora Roasters" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

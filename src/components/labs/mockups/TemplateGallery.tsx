"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, templatesByCategory, type MockupScene } from "@/lib/mockups/templates";
import { renderTemplate } from "@/lib/mockups/render";

/** Thumbnails render at 0.4× (480 px wide for a 1200 px template) — crisp at the sidebar width on HiDPI. */
const THUMB_SCALE = 0.4;

function idle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => fn(), { timeout: 400 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 16);
  return () => window.clearTimeout(id);
}

export function TemplateGallery({ scene, selectedId, onSelect }: { scene: MockupScene | null; selectedId: string; onSelect: (id: string) => void }) {
  const canvases = React.useRef(new Map<string, HTMLCanvasElement>());
  const [ready, setReady] = React.useState<Record<string, true>>({});
  const groups = React.useMemo(() => templatesByCategory(), []);

  // Render thumbnails lazily on idle time; the selected template first. Debounced so slider drags don't thrash.
  React.useEffect(() => {
    if (!scene) return;
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;
    const queue = groups.flatMap((g) => g.templates).sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0));
    const step = () => {
      if (cancelled) return;
      const t = queue.shift();
      if (!t) return;
      const canvas = canvases.current.get(t.id);
      if (canvas) {
        try {
          renderTemplate(t, scene, THUMB_SCALE, canvas);
          setReady((r) => (r[t.id] ? r : { ...r, [t.id]: true }));
        } catch (e) {
          console.error(`Mockup thumbnail failed: ${t.id}`, e);
        }
      }
      cancelIdle = idle(step);
    };
    const timer = window.setTimeout(() => {
      cancelIdle = idle(step);
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelIdle?.();
    };
  }, [scene, groups, selectedId]);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.category}>
          <div className="label mb-2">{CATEGORY_LABELS[g.category]}</div>
          <div className="grid gap-2">
            {g.templates.map((t) => {
              const selected = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-pressed={selected}
                  title={t.description}
                  className={cn(
                    "group text-left rounded-lg border overflow-hidden bg-bg-elev transition-[border-color,box-shadow] cursor-pointer",
                    selected ? "border-accent shadow-[0_0_0_2px_var(--accent-soft)]" : "border-line hover:border-line-strong",
                  )}
                >
                  <div className="relative bg-bg-inset" style={{ aspectRatio: `${t.size.width} / ${t.size.height}` }}>
                    <canvas
                      ref={(el) => {
                        if (el) canvases.current.set(t.id, el);
                        else canvases.current.delete(t.id);
                      }}
                      width={Math.round(t.size.width * THUMB_SCALE)}
                      height={Math.round(t.size.height * THUMB_SCALE)}
                      className="block w-full h-auto"
                      aria-label={`${t.name} preview`}
                    />
                    {!ready[t.id] && <div className="absolute inset-0 shimmer" />}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[12px]">
                    <span className={cn("truncate font-medium", selected ? "text-fg" : "text-fg-muted group-hover:text-fg")}>{t.name}</span>
                    <span className="text-fg-subtle font-mono text-[10px] shrink-0">
                      {t.size.width * 2}×{t.size.height * 2}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";
import * as React from "react";
import { fetchFonts } from "@/lib/api";
import type { FontMeta } from "@/app/api/fonts/route";
import { useProject } from "@/lib/store/project";
import type { Genome } from "@/lib/genome/schema";

export interface FontListState {
  fonts: FontMeta[];
  source: string;
  loading: boolean;
  error: string | null;
}

/** Font catalogue from /api/fonts (cached by the api helper). */
export function useFontList(): FontListState {
  const [state, setState] = React.useState<FontListState>({ fonts: [], source: "", loading: true, error: null });
  React.useEffect(() => {
    let alive = true;
    fetchFonts()
      .then((r) => alive && setState({ fonts: r.fonts, source: r.source, loading: false, error: null }))
      .catch((e) => alive && setState({ fonts: [], source: "", loading: false, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export type FontReach = "unknown" | "ok" | "offline";

/** Inspect document.fonts for the given families without any network call. */
export function probeFontFaces(families: string[]): FontReach {
  if (typeof document === "undefined" || !document.fonts) return "unknown";
  const faces: FontFace[] = [];
  document.fonts.forEach((f) => faces.push(f));
  const norm = (s: string) => s.replace(/^["']|["']$/g, "").trim().toLowerCase();
  let pending = false;
  for (const fam of families) {
    const mine = faces.filter((f) => norm(f.family) === fam.trim().toLowerCase());
    if (mine.some((f) => f.status === "loaded")) return "ok";
    if (mine.some((f) => f.status === "loading" || f.status === "unloaded")) pending = true;
  }
  return pending ? "unknown" : "offline";
}

/**
 * Whether Google Fonts CSS for the brand families actually produced usable
 * font faces. Checks after a short delay and again when the FontFaceSet settles.
 */
export function useFontsReachable(families: string[]): FontReach {
  const key = families.filter(Boolean).join("|");
  const [reach, setReach] = React.useState<FontReach>("unknown");
  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const fams = key.split("|");
    const probe = () => {
      if (!cancelled) setReach(probeFontFaces(fams));
    };
    const t1 = setTimeout(probe, 2500);
    const t2 = setTimeout(probe, 8000);
    const fs = typeof document !== "undefined" ? document.fonts : undefined;
    fs?.addEventListener("loadingdone", probe);
    fs?.addEventListener("loadingerror", probe);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      fs?.removeEventListener("loadingdone", probe);
      fs?.removeEventListener("loadingerror", probe);
    };
  }, [key]);
  return reach;
}

export type GenomeEdit = (fn: (g: Genome) => void, summary: string, opts?: { debounce?: boolean }) => void;

/**
 * Genome editor for the Type lab. Discrete edits are recorded immediately;
 * `debounce: true` applies the change at once but records a single history
 * entry per burst so sliders and number inputs don't flood the history.
 */
export function useGenomeEditor(): GenomeEdit {
  const update = useProject((s) => s.update);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  return React.useCallback<GenomeEdit>(
    (fn, summary, opts) => {
      if (!opts?.debounce) {
        update(fn, { summary, stage: "type" });
        return;
      }
      update(fn);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        update(() => {}, { summary, stage: "type" });
      }, 600);
    },
    [update],
  );
}

"use client";
import { create } from "zustand";
import { debounce, uid } from "@/lib/utils";
import { type Genome, type StageId, type StageStatus, safeParseGenome } from "@/lib/genome/schema";
import { applyOperations, type GenomeOperation } from "@/lib/genome/paths";
import { type Asset, deleteAsset as dbDeleteAsset, getProject, listAssets, putAsset, saveProject } from "@/lib/db";

interface ProjectState {
  genome: Genome | null;
  assets: Asset[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  /** Increments on every genome mutation so labs can react cheaply */
  rev: number;

  load: (id: string) => Promise<void>;
  unload: () => void;
  /** Functional update; recorded to history when `summary` is given. */
  update: (fn: (g: Genome) => Genome | void, opts?: { summary?: string; actor?: "user" | "ai" | "system"; stage?: StageId }) => void;
  /** Applies dot-path operations; returns false (and changes nothing) when the result would be invalid. */
  applyOps: (ops: GenomeOperation[], opts?: { summary?: string; actor?: "user" | "ai" | "system"; stage?: StageId }) => boolean;
  /** Writes any pending autosave immediately. */
  flush: () => Promise<void>;
  setStage: (stage: StageId, status: StageStatus) => void;
  addAsset: (asset: Omit<Asset, "id" | "projectId" | "createdAt"> & { id?: string }) => Promise<Asset>;
  removeAsset: (id: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
  replaceGenome: (g: Genome) => void;
}

/** Pending autosave; flushed on a debounce and on pagehide/visibility change so nothing is lost on reload. */
let pending: { genome: Genome; set: (p: Partial<ProjectState>) => void } | null = null;
let listenersInstalled = false;

async function flushPending() {
  const p = pending;
  if (!p) return;
  pending = null;
  try {
    p.set({ saving: true });
    await saveProject(p.genome);
  } finally {
    p.set({ saving: false });
  }
}

const scheduleFlush = debounce(() => void flushPending(), 400);

function persist(genome: Genome, set: (p: Partial<ProjectState>) => void) {
  pending = { genome, set };
  if (!listenersInstalled && typeof window !== "undefined") {
    listenersInstalled = true;
    window.addEventListener("pagehide", () => void flushPending());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void flushPending();
    });
  }
  scheduleFlush();
}

/** Drops null holes and re-parses so a damaged document still opens. */
function repairGenome(raw: unknown): Genome | null {
  const direct = safeParseGenome(raw);
  if (direct.ok) return direct.genome;
  try {
    const cleaned = JSON.parse(JSON.stringify(raw), (_k, v) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined) : v));
    const again = safeParseGenome(cleaned);
    return again.ok ? again.genome : null;
  } catch {
    return null;
  }
}

export const useProject = create<ProjectState>()((set, get) => ({
  genome: null,
  assets: [],
  loading: false,
  error: null,
  saving: false,
  rev: 0,

  load: async (id) => {
    set({ loading: true, error: null });
    try {
      await flushPending();
      const row = await getProject(id);
      if (!row) {
        set({ loading: false, error: "Project not found", genome: null, assets: [] });
        return;
      }
      const genome = repairGenome(row.genome);
      if (!genome) {
        set({ loading: false, error: "This project's data could not be read. Import a bundle backup or start a new brand.", genome: null, assets: [] });
        return;
      }
      const assets = await listAssets(id);
      set({ genome, assets, loading: false, rev: get().rev + 1 });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  unload: () => {
    void flushPending();
    for (const u of urlCache.values()) URL.revokeObjectURL(u);
    urlCache.clear();
    set({ genome: null, assets: [], error: null });
  },

  flush: () => flushPending(),

  update: (fn, opts) => {
    const g = get().genome;
    if (!g) return;
    const draft = structuredClone(g);
    const result = fn(draft);
    const next = (result ?? draft) as Genome;
    next.updatedAt = Date.now();
    if (opts?.summary) {
      next.history = [
        ...next.history.slice(-199),
        { id: uid(8), ts: Date.now(), actor: opts.actor ?? "user", summary: opts.summary, stage: opts.stage },
      ];
    }
    set({ genome: next, rev: get().rev + 1 });
    persist(next, set);
  },

  applyOps: (ops, opts) => {
    const g = get().genome;
    if (!g) return false;
    let next: Genome;
    try {
      next = applyOperations(g, ops);
    } catch {
      return false;
    }
    const parsed = safeParseGenome(next);
    if (!parsed.ok) return false;
    get().update(() => parsed.genome, opts);
    return true;
  },

  setStage: (stage, status) => {
    get().update(
      (g) => {
        g.stages[stage] = status;
      },
      { summary: `${stage[0].toUpperCase()}${stage.slice(1)} marked ${status.replace("-", " ")}`, stage },
    );
  },

  addAsset: async (partial) => {
    const g = get().genome;
    if (!g) throw new Error("No project loaded");
    const asset: Asset = { ...partial, id: partial.id ?? uid(12), projectId: g.id, createdAt: Date.now() } as Asset;
    await putAsset(asset);
    set({ assets: [asset, ...get().assets] });
    return asset;
  },

  removeAsset: async (id) => {
    await dbDeleteAsset(id);
    for (const [key, url] of urlCache) {
      if (key.startsWith(`${id}:`)) {
        URL.revokeObjectURL(url);
        urlCache.delete(key);
      }
    }
    set({ assets: get().assets.filter((a) => a.id !== id) });
  },

  refreshAssets: async () => {
    const g = get().genome;
    if (!g) return;
    set({ assets: await listAssets(g.id) });
  },

  replaceGenome: (genome) => {
    set({ genome, rev: get().rev + 1 });
    persist(genome, set);
  },
}));

/** Object URL cache for asset blobs; revoked when the project unloads or an asset is removed. */
const urlCache = new Map<string, string>();
export function assetUrl(asset: Asset | undefined): string {
  if (!asset) return "";
  const key = `${asset.id}:${asset.blob.size}`;
  let url = urlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(asset.blob);
    urlCache.set(key, url);
  }
  return url;
}

export function useAsset(id: string | undefined): Asset | undefined {
  return useProject((s) => (id ? s.assets.find((a) => a.id === id) : undefined));
}

"use client";
import { create } from "zustand";
import { debounce, uid } from "@/lib/utils";
import { type Genome, type StageId, type StageStatus, parseGenome } from "@/lib/genome/schema";
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
  applyOps: (ops: GenomeOperation[], opts?: { summary?: string; actor?: "user" | "ai" | "system"; stage?: StageId }) => void;
  setStage: (stage: StageId, status: StageStatus) => void;
  addAsset: (asset: Omit<Asset, "id" | "projectId" | "createdAt"> & { id?: string }) => Promise<Asset>;
  removeAsset: (id: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
  replaceGenome: (g: Genome) => void;
}

const persist = debounce(async (g: Genome, set: (p: Partial<ProjectState>) => void) => {
  try {
    set({ saving: true });
    await saveProject(g);
  } finally {
    set({ saving: false });
  }
}, 400);

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
      const row = await getProject(id);
      if (!row) {
        set({ loading: false, error: "Project not found", genome: null, assets: [] });
        return;
      }
      const genome = parseGenome(row.genome);
      const assets = await listAssets(id);
      set({ genome, assets, loading: false, rev: get().rev + 1 });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  unload: () => set({ genome: null, assets: [], error: null }),

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
    get().update((g) => applyOperations(g, ops), opts);
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

/** Convenience: object URL cache for asset blobs (revoked on unload). */
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

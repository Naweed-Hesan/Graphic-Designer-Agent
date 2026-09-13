"use client";
import Dexie, { type EntityTable } from "dexie";
import type { Genome, StageId } from "@/lib/genome/schema";

export type AssetKind = "image" | "svg" | "video" | "font" | "file";

export interface Asset {
  id: string;
  projectId: string;
  kind: AssetKind;
  name: string;
  mime: string;
  blob: Blob;
  /** SVG source text (for kind === "svg") so it can be edited without decoding */
  svg?: string;
  width?: number;
  height?: number;
  duration?: number;
  prompt?: string;
  provider?: string;
  model?: string;
  seed?: number;
  stage: StageId;
  tags: string[];
  parentId?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Tool calls the assistant made during this turn */
  tools?: { id: string; name: string; args: unknown; result?: unknown; status: "running" | "done" | "error" }[];
  images?: string[]; // asset ids attached
  createdAt: number;
}

export interface ChatThread {
  id: string;
  projectId: string;
  title: string;
  messages: ChatMessage[];
  provider: string;
  /** Claude Agent SDK session id for resume */
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectRow {
  id: string;
  name: string;
  genome: Genome;
  updatedAt: number;
  createdAt: number;
  thumbnailAssetId?: string;
}

export class LigatureDB extends Dexie {
  projects!: EntityTable<ProjectRow, "id">;
  assets!: EntityTable<Asset, "id">;
  threads!: EntityTable<ChatThread, "id">;

  constructor() {
    super("ligature");
    this.version(1).stores({
      projects: "id, name, updatedAt",
      assets: "id, projectId, kind, stage, createdAt, [projectId+kind], [projectId+stage]",
      threads: "id, projectId, updatedAt",
    });
  }
}

let _db: LigatureDB | null = null;
export function db(): LigatureDB {
  if (!_db) _db = new LigatureDB();
  return _db;
}

export async function listProjects(): Promise<ProjectRow[]> {
  return db().projects.orderBy("updatedAt").reverse().toArray();
}

export async function getProject(id: string): Promise<ProjectRow | undefined> {
  return db().projects.get(id);
}

export async function saveProject(genome: Genome): Promise<void> {
  const existing = await db().projects.get(genome.id);
  await db().projects.put({
    id: genome.id,
    name: genome.name,
    genome,
    createdAt: existing?.createdAt ?? genome.createdAt,
    updatedAt: Date.now(),
    thumbnailAssetId: existing?.thumbnailAssetId,
  });
}

export async function deleteProject(id: string): Promise<void> {
  await db().transaction("rw", db().projects, db().assets, db().threads, async () => {
    await db().assets.where("projectId").equals(id).delete();
    await db().threads.where("projectId").equals(id).delete();
    await db().projects.delete(id);
  });
}

export async function listAssets(projectId: string): Promise<Asset[]> {
  return db().assets.where("projectId").equals(projectId).reverse().sortBy("createdAt");
}

export async function putAsset(asset: Asset): Promise<void> {
  await db().assets.put(asset);
}

export async function deleteAsset(id: string): Promise<void> {
  await db().assets.delete(id);
}

export async function getThread(projectId: string): Promise<ChatThread | undefined> {
  return db().threads.where("projectId").equals(projectId).first();
}

export async function saveThread(thread: ChatThread): Promise<void> {
  await db().threads.put({ ...thread, updatedAt: Date.now() });
}

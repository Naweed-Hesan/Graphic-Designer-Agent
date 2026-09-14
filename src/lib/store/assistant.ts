"use client";
/**
 * Creative Director state lives outside the panel component so a reply keeps
 * streaming when the panel is hidden, re-opened or re-laid-out, and so every
 * event is checked against the project it was requested for.
 */
import { create } from "zustand";
import { toast } from "sonner";
import { getThread, saveThread, type ChatMessage, type ChatThread } from "@/lib/db";
import { streamChat } from "@/lib/api";
import type { ChatEvent } from "@/lib/ai/events";
import type { StageId } from "@/lib/genome/schema";
import { dataUrlToBlob, uid } from "@/lib/utils";
import { useProject } from "./project";
import { useSettings } from "./settings";

const controllers = new Map<string, AbortController>();

function mkMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: uid(8), role, content, tools: role === "assistant" ? [] : undefined, createdAt: Date.now() };
}

function newThread(projectId: string, provider: string): ChatThread {
  const now = Date.now();
  return { id: uid(10), projectId, title: "Creative Director", messages: [], provider, createdAt: now, updatedAt: now };
}

interface AssistantState {
  threads: Record<string, ChatThread>;
  busy: Record<string, boolean>;
  status: Record<string, string | null>;
  load: (projectId: string) => Promise<void>;
  send: (projectId: string, text: string, stage: StageId) => Promise<void>;
  stop: (projectId: string) => void;
  clear: (projectId: string) => void;
}

export const useAssistant = create<AssistantState>()((set, get) => ({
  threads: {},
  busy: {},
  status: {},

  load: async (projectId) => {
    if (get().threads[projectId]) return;
    const provider = useSettings.getState().assistant.provider;
    const t = (await getThread(projectId)) ?? newThread(projectId, provider);
    if (!get().threads[projectId]) set({ threads: { ...get().threads, [projectId]: t } });
  },

  stop: (projectId) => {
    controllers.get(projectId)?.abort();
  },

  clear: (projectId) => {
    const t = get().threads[projectId];
    if (!t) return;
    get().stop(projectId);
    const next = { ...t, messages: [], sessionId: undefined };
    set({ threads: { ...get().threads, [projectId]: next } });
    saveThread(next).catch(() => {});
  },

  send: async (projectId, text, stage) => {
    const state = get();
    const thread = state.threads[projectId];
    if (!thread || state.busy[projectId] || !text.trim()) return;
    const provider = useSettings.getState().assistant.provider;
    const userMsg = mkMessage("user", text.trim());
    const assistantMsg = mkMessage("assistant", "");
    let current: ChatThread = { ...thread, provider, messages: [...thread.messages, userMsg, assistantMsg] };
    const setThread = (t: ChatThread) => set({ threads: { ...get().threads, [projectId]: t } });
    const setStatus = (s: string | null) => set({ status: { ...get().status, [projectId]: s } });
    setThread(current);
    saveThread(current).catch(() => {});
    set({ busy: { ...get().busy, [projectId]: true } });
    setStatus("Thinking…");
    const ctrl = new AbortController();
    controllers.set(projectId, ctrl);

    const patch = (fn: (m: ChatMessage) => void) => {
      const msgs = current.messages.map((m) => (m.id === assistantMsg.id ? { ...m, tools: m.tools ? [...m.tools] : [] } : m));
      fn(msgs[msgs.length - 1]);
      current = { ...current, messages: msgs };
      setThread(current);
    };
    const sameProject = () => useProject.getState().genome?.id === projectId;
    let warnedWrongProject = false;
    const warnWrongProject = () => {
      if (warnedWrongProject) return;
      warnedWrongProject = true;
      toast.message("The Director finished a request for another project; its edits were not applied here.");
    };

    try {
      await streamChat(
        {
          messages: current.messages.filter((m) => m.id !== assistantMsg.id).map((m) => ({ role: m.role, content: m.content })),
          genome: useProject.getState().genome,
          assets: useProject.getState().assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, stage: a.stage, prompt: a.prompt })),
          stage,
          sessionId: thread.provider === provider ? thread.sessionId : undefined,
          provider,
        },
        async (e: ChatEvent) => {
          switch (e.type) {
            case "status":
              setStatus(e.message);
              break;
            case "text":
              setStatus(null);
              patch((m) => void (m.content += e.delta));
              break;
            case "tool-start":
              setStatus(`Using ${e.name}…`);
              patch((m) => m.tools!.push({ id: e.id, name: e.name, args: e.args, status: "running" }));
              break;
            case "tool-end":
              patch((m) => {
                const t = m.tools!.find((x) => x.id === e.id);
                if (t) {
                  t.status = e.error ? "error" : "done";
                  t.result = e.error ?? e.result;
                }
              });
              break;
            case "genome-ops": {
              if (!sameProject()) {
                warnWrongProject();
                break;
              }
              const ok = useProject.getState().applyOps(e.ops, { summary: e.summary, actor: "ai", stage });
              if (ok) toast.success(e.summary, { duration: 2500 });
              else toast.error(`Skipped an edit that would have made the Genome invalid: ${e.summary}`);
              break;
            }
            case "asset": {
              if (!sameProject()) {
                warnWrongProject();
                break;
              }
              try {
                const blob = dataUrlToBlob(e.asset.dataUrl);
                const a = await useProject.getState().addAsset({ kind: e.asset.kind, name: e.asset.name, mime: e.asset.mime, blob, prompt: e.asset.prompt, provider: e.asset.provider, model: e.asset.model, stage: e.asset.stage as StageId, tags: e.asset.tags ?? [], width: e.asset.width, height: e.asset.height });
                patch((m) => void (m.images = [...(m.images ?? []), a.id]));
              } catch (err) {
                toast.error(`Could not save a generated asset: ${err instanceof Error ? err.message : String(err)}`);
              }
              break;
            }
            case "done":
              current = { ...current, sessionId: e.sessionId ?? current.sessionId, provider };
              break;
            case "error":
              patch((m) => void (m.content += `\n\n> **Error:** ${e.message}${e.hint ? `\n>\n> ${e.hint}` : ""}`));
              toast.error(e.message);
              break;
          }
        },
        ctrl.signal,
      );
    } catch (err) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : String(err);
        patch((m) => void (m.content += `\n\n> **Error:** ${msg}`));
        toast.error(msg);
      }
    } finally {
      if (controllers.get(projectId) === ctrl) controllers.delete(projectId);
      set({ busy: { ...get().busy, [projectId]: false }, status: { ...get().status, [projectId]: null } });
      // A message with no content after an abort is noise; drop it.
      if (!current.messages[current.messages.length - 1]?.content && ctrl.signal.aborted) {
        current = { ...current, messages: current.messages.filter((m) => m.id !== assistantMsg.id) };
      }
      setThread(current);
      saveThread(current).catch(() => {});
    }
  },
}));

/**
 * Claude Agent SDK bridge.
 *
 * Runs Claude Code's agent loop in-process with Ligature's tools exposed as an
 * in-process MCP server. Authentication is whatever the local Claude Code has:
 * a `claude` login (subscription) or ANTHROPIC_API_KEY. Ligature never touches
 * credentials itself.
 */
import { query, createSdkMcpServer, tool, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { CREATIVE_DIRECTOR_PROMPT } from "./system-prompt";
import { TOOLS, runTool, genomeBrief, type ToolContext } from "./tools";
import type { ChatEvent } from "./events";

export interface ClaudeRunOptions {
  messages: { role: "user" | "assistant"; content: string }[];
  ctx: ToolContext;
  sessionId?: string;
  model?: string;
  signal?: AbortSignal;
}

function agentCwd(): string {
  const dir = path.join(os.homedir(), ".ligature", "agent");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function buildPrompt(messages: ClaudeRunOptions["messages"], ctx: ToolContext, includeHistory: boolean): string {
  const last = messages[messages.length - 1];
  const brief = genomeBrief(ctx.genome, ctx.stage);
  if (!includeHistory || messages.length <= 1) return `${brief}\n\n${last?.content ?? ""}`;
  const history = messages
    .slice(0, -1)
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Designer" : "Creative Director"}: ${m.content}`)
    .join("\n\n");
  return `${brief}\n\nEarlier in this conversation:\n${history}\n\nDesigner: ${last?.content ?? ""}`;
}

export function claudeAuthHint(): string {
  return "Ligature uses the Claude Agent SDK, which runs on your local Claude Code login. Install Claude Code (npm i -g @anthropic-ai/claude-code), run `claude` once and sign in with your Claude subscription, or set ANTHROPIC_API_KEY. Then retry.";
}

export async function runClaudeAgent(opts: ClaudeRunOptions): Promise<void> {
  const { ctx, signal } = opts;
  const emit = (e: ChatEvent) => ctx.emit(e);
  let counter = 0;

  const mcpTools = TOOLS.map((t) =>
    tool(t.name, t.description, t.shape, async (args) => {
      const id = `t${Date.now().toString(36)}${counter++}`;
      emit({ type: "tool-start", id, name: t.name, args });
      const text = await runTool(t.name, args, ctx, id);
      return { content: [{ type: "text", text }] };
    }, { annotations: { readOnlyHint: t.readOnly ?? false } }),
  );
  const server = createSdkMcpServer({ name: "ligature", version: "1.0.0", tools: mcpTools });
  const allowedTools = TOOLS.map((t) => `mcp__ligature__${t.name}`);

  const attempt = async (resume: string | undefined): Promise<{ ok: boolean; retryFresh: boolean }> => {
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    signal?.addEventListener("abort", onAbort);
    let sessionId = resume;
    let sawText = false;
    let sawError: string | null = null;
    try {
      const q = query({
        prompt: buildPrompt(opts.messages, ctx, !resume),
        options: {
          cwd: agentCwd(),
          systemPrompt: CREATIVE_DIRECTOR_PROMPT,
          tools: [],
          mcpServers: { ligature: server },
          allowedTools,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          settingSources: [],
          includePartialMessages: true,
          maxTurns: 24,
          resume,
          model: opts.model || undefined,
          abortController: abort,
          persistSession: true,
        },
      });
      for await (const msg of q as AsyncIterable<SDKMessage>) {
        if (msg.type === "system" && msg.subtype === "init") {
          sessionId = msg.session_id;
          emit({ type: "status", message: `Claude ${msg.model} · auth via ${msg.apiKeySource}` });
        } else if (msg.type === "stream_event") {
          const ev = msg.event as { type: string; delta?: { type: string; text?: string } };
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
            sawText = true;
            emit({ type: "text", delta: ev.delta.text });
          }
        } else if (msg.type === "assistant") {
          if (msg.error) sawError = msg.error;
        } else if (msg.type === "result") {
          if (msg.subtype === "success" && !msg.is_error) {
            if (!sawText && msg.result) emit({ type: "text", delta: msg.result });
            emit({ type: "done", sessionId: msg.session_id || sessionId, provider: "claude-agent", costUsd: msg.total_cost_usd });
            return { ok: true, retryFresh: false };
          }
          const errText = msg.subtype === "success" ? msg.result : (msg as { errors?: string[] }).errors?.join("; ") || msg.subtype;
          if (resume && /session|resume|not found|no conversation/i.test(errText || "")) return { ok: false, retryFresh: true };
          const auth = sawError === "authentication_failed" || /authentication|not logged in|login|OAuth|api key/i.test(errText || "");
          emit({ type: "error", message: errText || "Claude returned an error", hint: auth ? claudeAuthHint() : undefined });
          return { ok: false, retryFresh: false };
        }
      }
      if (sawError) {
        emit({ type: "error", message: `Claude error: ${sawError}`, hint: sawError === "authentication_failed" ? claudeAuthHint() : undefined });
        return { ok: false, retryFresh: false };
      }
      emit({ type: "done", sessionId, provider: "claude-agent" });
      return { ok: true, retryFresh: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (signal?.aborted) return { ok: false, retryFresh: false };
      if (resume && /session|resume/i.test(msg)) return { ok: false, retryFresh: true };
      const auth = /authentication|not logged in|OAuth|api key|401/i.test(msg);
      emit({ type: "error", message: msg, hint: auth || /executable|spawn|ENOENT/i.test(msg) ? claudeAuthHint() : undefined });
      return { ok: false, retryFresh: false };
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  };

  const first = await attempt(opts.sessionId);
  if (!first.ok && first.retryFresh) {
    emit({ type: "status", message: "Previous Claude session expired — starting a fresh one with the conversation summary" });
    await attempt(undefined);
  }
}

/** Cheap connectivity probe: one turn, no tools. Cached by the status route. */
export async function probeClaude(): Promise<{ available: boolean; model?: string; apiKeySource?: string; version?: string; error?: string }> {
  try {
    const q = query({
      prompt: "Reply with the single word OK.",
      options: { cwd: agentCwd(), tools: [], settingSources: [], maxTurns: 1, persistSession: false, systemPrompt: "You are a connectivity probe." },
    });
    let info: { model?: string; apiKeySource?: string; version?: string } = {};
    for await (const msg of q as AsyncIterable<SDKMessage>) {
      if (msg.type === "system" && msg.subtype === "init") info = { model: msg.model, apiKeySource: String(msg.apiKeySource), version: msg.claude_code_version };
      if (msg.type === "assistant" && msg.error) return { available: false, ...info, error: msg.error };
      if (msg.type === "result") {
        if (msg.subtype === "success" && !msg.is_error) return { available: true, ...info };
        return { available: false, ...info, error: msg.subtype === "success" ? msg.result : (msg as { errors?: string[] }).errors?.join("; ") || msg.subtype };
      }
    }
    return { available: false, ...info, error: "No result" };
  } catch (e) {
    return { available: false, error: e instanceof Error ? e.message : String(e) };
  }
}

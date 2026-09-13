/**
 * OpenAI-compatible chat + function-calling loop. Covers Pollinations, Gemini
 * (OpenAI compatibility endpoint), Cloudflare Workers AI, Groq, OpenRouter,
 * Ollama, LM Studio — anything that speaks /v1/chat/completions.
 */
import { CREATIVE_DIRECTOR_PROMPT } from "./system-prompt";
import { TOOLS, runTool, toolJsonSchema, genomeBrief, type ToolContext } from "./tools";
import { fetchWithTimeout } from "@/lib/providers/types";

export interface OpenAICompatOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  providerId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  ctx: ToolContext;
  signal?: AbortSignal;
  /** Some gateways reject tools; set false to run without them */
  useTools?: boolean;
}

type OAMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: OAToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface OAToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

function cleanSchema(s: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _s, ...rest } = s;
  void _s;
  return rest;
}

export async function resolveModel(baseUrl: string, apiKey: string | undefined, signal?: AbortSignal): Promise<string> {
  const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined, signal, timeoutMs: 15_000 });
  if (!res.ok) throw new Error(`Could not list models (${res.status}) — set a model name in Settings`);
  const j = (await res.json()) as { data?: { id: string; capabilities?: unknown; tools?: boolean }[] };
  const ids = (j.data ?? []).map((m) => m.id);
  const preferred = ids.find((id) => /gpt|openai|claude|gemini|llama|qwen|mistral|deepseek|grok/i.test(id) && !/embed|tts|whisper|image|audio|vision-only|realtime/i.test(id));
  const pick = preferred || ids[0];
  if (!pick) throw new Error("Provider returned no models — set a model name in Settings");
  return pick;
}

export async function runOpenAICompat(opts: OpenAICompatOptions): Promise<void> {
  const { ctx, signal, providerId } = opts;
  const emit = ctx.emit;
  const base = opts.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream, application/json" };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  let model = opts.model;
  if (!model) {
    emit({ type: "status", message: "Choosing a model…" });
    model = await resolveModel(base, opts.apiKey, signal);
  }

  const last = opts.messages[opts.messages.length - 1];
  const history: OAMessage[] = [
    { role: "system", content: CREATIVE_DIRECTOR_PROMPT },
    ...opts.messages.slice(0, -1).slice(-16).map((m) => ({ role: m.role, content: m.content }) as OAMessage),
    { role: "user", content: `${genomeBrief(ctx.genome, ctx.stage)}\n\n${last?.content ?? ""}` },
  ];
  const tools = opts.useTools === false ? undefined : TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: cleanSchema(toolJsonSchema(t)) } }));

  let counter = 0;
  for (let round = 0; round < 8; round++) {
    const body: Record<string, unknown> = { model, messages: history, stream: true, temperature: 0.7 };
    if (tools) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    const res = await fetchWithTimeout(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal, timeoutMs: 180_000 });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let msg = text.slice(0, 400) || res.statusText;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.message || msg;
      } catch {}
      if (tools && round === 0 && /tool|function/i.test(msg) && res.status === 400) {
        emit({ type: "status", message: "This model rejected tools — continuing without tool use" });
        return runOpenAICompat({ ...opts, model, useTools: false });
      }
      const hint = res.status === 401 || res.status === 403 ? `Check the API key for ${providerId} in Settings.` : res.status === 404 || /model/i.test(msg) ? `Check the model name for ${providerId} in Settings.` : res.status === 429 ? "Rate limited — wait a moment or switch provider." : undefined;
      emit({ type: "error", message: `${providerId} ${res.status}: ${msg}`, hint });
      return;
    }

    let text = "";
    const calls = new Map<number, OAToolCall>();
    const ct = res.headers.get("content-type") || "";
    const handleDelta = (delta: { content?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }) => {
      if (delta.content) {
        text += delta.content;
        emit({ type: "text", delta: delta.content });
      }
      for (const tc of delta.tool_calls ?? []) {
        const idx = tc.index ?? calls.size;
        const cur = calls.get(idx) ?? { id: tc.id || `call_${counter++}`, type: "function" as const, function: { name: "", arguments: "" } };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.function.name += tc.function.name;
        if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
        calls.set(idx, cur);
      }
    };

    if (ct.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data) as { choices?: { delta?: Parameters<typeof handleDelta>[0]; message?: Parameters<typeof handleDelta>[0] }[]; error?: { message?: string } };
            if (j.error?.message) {
              emit({ type: "error", message: `${providerId}: ${j.error.message}` });
              return;
            }
            const c = j.choices?.[0];
            if (c?.delta) handleDelta(c.delta);
            else if (c?.message) handleDelta(c.message);
          } catch {}
        }
      }
    } else {
      const j = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: OAToolCall[] } }[]; error?: { message?: string } };
      if (j.error?.message) {
        emit({ type: "error", message: `${providerId}: ${j.error.message}` });
        return;
      }
      const m = j.choices?.[0]?.message;
      if (m?.content) {
        text += m.content;
        emit({ type: "text", delta: m.content });
      }
      (m?.tool_calls ?? []).forEach((tc, i) => calls.set(i, tc));
    }

    if (!calls.size) {
      emit({ type: "done", provider: providerId, model });
      return;
    }
    const toolCalls = [...calls.values()].filter((c) => c.function.name);
    history.push({ role: "assistant", content: text || null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      let args: unknown = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      emit({ type: "tool-start", id: call.id, name: call.function.name, args });
      const result = await runTool(call.function.name, args, ctx, call.id);
      history.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  emit({ type: "done", provider: providerId, model });
}

import type { ProviderSettings } from "@/lib/providers/types";
import type { ChatRequestBody, ChatEvent } from "./events";
import type { ToolContext } from "./tools";
import { runClaudeAgent } from "./claude-agent";
import { runOpenAICompat } from "./openai-compat";
import { POLLINATIONS_BASE } from "@/lib/providers/image/pollinations";

export type AssistantProviderId = NonNullable<ChatRequestBody["provider"]>;

export function assistantEndpoint(provider: AssistantProviderId, s: ProviderSettings): { baseUrl: string; apiKey?: string; model: string; label: string } | null {
  const p = s.providers;
  switch (provider) {
    case "pollinations":
      return { baseUrl: `${POLLINATIONS_BASE}/v1`, apiKey: p.pollinations.apiKey || undefined, model: p.pollinations.textModel, label: "Pollinations" };
    case "gemini":
      return { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: p.gemini.apiKey, model: p.gemini.textModel || "gemini-2.5-flash", label: "Gemini" };
    case "cloudflare":
      return { baseUrl: `https://api.cloudflare.com/client/v4/accounts/${p.cloudflare.accountId}/ai/v1`, apiKey: p.cloudflare.apiToken, model: p.cloudflare.textModel, label: "Cloudflare Workers AI" };
    case "openai-compat":
      return { baseUrl: p.openaiCompat.baseUrl, apiKey: p.openaiCompat.apiKey || undefined, model: p.openaiCompat.model, label: p.openaiCompat.label || "OpenAI-compatible" };
    default:
      return null;
  }
}

export async function runAssistant(body: ChatRequestBody, settings: ProviderSettings, ctx: ToolContext, emit: (e: ChatEvent) => void): Promise<void> {
  const provider = body.provider ?? settings.assistant.provider;
  if (provider === "claude-agent") {
    await runClaudeAgent({ messages: body.messages, ctx, sessionId: body.sessionId, model: settings.providers.claude.model || undefined, signal: ctx.signal });
    return;
  }
  const ep = assistantEndpoint(provider, settings);
  if (!ep) {
    emit({ type: "error", message: `Unknown assistant provider ${provider}` });
    return;
  }
  if (provider === "gemini" && !ep.apiKey) {
    emit({ type: "error", message: "Gemini needs an API key", hint: "Get a free key at aistudio.google.com and add it in Settings → Providers." });
    return;
  }
  if (provider === "cloudflare" && (!settings.providers.cloudflare.accountId || !ep.apiKey)) {
    emit({ type: "error", message: "Cloudflare Workers AI needs an account id and API token", hint: "Both are free at dash.cloudflare.com → AI → Workers AI." });
    return;
  }
  if (provider === "openai-compat" && !ep.baseUrl) {
    emit({ type: "error", message: "Set a base URL for your OpenAI-compatible provider in Settings." });
    return;
  }
  await runOpenAICompat({ baseUrl: ep.baseUrl, apiKey: ep.apiKey, model: ep.model, providerId: ep.label, messages: body.messages, ctx, signal: ctx.signal });
}

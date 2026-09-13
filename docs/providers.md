# Providers

Ligature is built to run without paying for any service. Providers are tried in the order you set in **Providers → Images / Video**; the first that succeeds wins. Keys live in your browser and are sent to *your own* Ligature server per request via a header; nothing is stored server-side. Server-side `.env.local` values fill in whenever a field is empty.

| Provider | Endpoint used | Notes |
|---|---|---|
| Pollinations | `https://gen.pollinations.ai/image/{prompt}`, `/v1/images/edits`, `/video/{prompt}`, `/v1/chat/completions` | FLUX images work anonymously; premium models and video spend Pollen (free weekly grant with a free key). |
| Cloudflare Workers AI | `POST /accounts/{id}/ai/run/@cf/black-forest-labs/flux-1-schnell`, `/ai/v1/chat/completions` | 10,000 neurons/day free ≈ 170 FLUX images. FLUX schnell renders 1024² only. |
| Google Gemini | `@google/genai` `generateContent` with `responseModalities: ["IMAGE","TEXT"]`; OpenAI-compatible endpoint for chat | Image generation and editing (multi-turn). Free-tier availability differs per image model; text models have a generous free tier. |
| Hugging Face Space | `@gradio/client` — connects to any Space, introspects `view_api()` and maps parameters by name (`prompt`, `image`, `seed`, `width`, `height`, `duration`…) | Works with `black-forest-labs/FLUX.1-schnell`, `Lightricks/ltx-2-distilled`, `Lightricks/LTX-2.5` and most community Spaces. Free ZeroGPU quota; a token raises it. |
| Claude Agent SDK | `@anthropic-ai/claude-agent-sdk` `query()` with an in-process MCP server exposing Ligature's tools | Uses the local Claude Code login or `ANTHROPIC_API_KEY`. Sessions resume between turns. |
| OpenAI-compatible | `{baseUrl}/chat/completions` with function calling | Ollama (`http://localhost:11434/v1`), LM Studio, Groq, OpenRouter… |

## Adding a provider
1. Implement `ImageProvider` or `VideoProvider` from `src/lib/providers/types.ts`.
2. Register it in `src/lib/providers/image/index.ts` or `video/index.ts` and add its id to the settings enums (`src/lib/store/settings.ts`, `src/lib/providers/types.ts`).
3. Add fields to the Settings dialog and a row in this document.

Providers must degrade gracefully: throw `ProviderError` with a human-readable message and `retryable=false` for auth/billing errors so the chain moves on.

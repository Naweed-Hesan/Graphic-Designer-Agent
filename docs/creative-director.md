# The Creative Director

The assistant is a senior brand strategist persona (`src/lib/ai/system-prompt.ts`) with tools defined once in `src/lib/ai/tools.ts`:

| Tool | Effect |
|---|---|
| `get_genome` | Read the Genome (all or a section) |
| `update_genome` | Set values by dot-path; validated against the schema; recorded in history |
| `set_palette` | Replace the palette with role-assigned colours; returns contrast checks |
| `set_typography` | Set display/body families, scale ratio and rationale |
| `compile_prompt` | Preview the brand-conditioned prompt for a subject/purpose |
| `generate_image` | Generate on-brand images through the provider chain; results are saved as project assets |
| `check_contrast` | WCAG 2 ratio + APCA Lc for two colours |
| `list_assets` | List project assets |
| `set_stage_status` | Move a stage between todo / in-progress / done |

## Transport
`POST /api/ai/chat` streams NDJSON events: `status`, `text` (deltas), `tool-start`, `tool-end`, `genome-ops` (applied live in the studio), `asset` (saved to the project), `done` (with a session id for Claude), `error` (with a hint).

## Backends
- **Claude Agent SDK**: `query()` with `tools: []` (no built-in tools), an in-process MCP server named `ligature`, `permissionMode: "bypassPermissions"` and `settingSources: []` so no filesystem settings leak in. Sessions are resumed with the id returned in `done`; if a session expired, Ligature restarts with a compact conversation summary.
- **OpenAI-compatible**: a streaming function-calling loop (max 8 rounds) that works with Pollinations, Gemini's OpenAI endpoint, Cloudflare Workers AI, Groq, OpenRouter, Ollama and LM Studio. If a model rejects tools, the loop retries without them.

The Genome is passed with every request and a compact brief is prepended to each user turn, so the assistant rarely needs a tool call for context.

/** Events streamed from /api/ai/chat as NDJSON. */
export type AssetEvent = {
  name: string;
  mime: string;
  dataUrl: string;
  kind: "image" | "svg" | "video";
  prompt?: string;
  provider?: string;
  model?: string;
  stage: string;
  width?: number;
  height?: number;
  tags?: string[];
};

export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "tool-start"; id: string; name: string; args: unknown }
  | { type: "tool-end"; id: string; name: string; result?: unknown; error?: string }
  | { type: "genome-ops"; ops: { path: string; value: unknown }[]; summary: string }
  | { type: "asset"; asset: AssetEvent }
  | { type: "done"; sessionId?: string; provider: string; costUsd?: number; model?: string }
  | { type: "error"; message: string; hint?: string };

export interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  genome: unknown;
  assets: { id: string; name: string; kind: string; stage: string; prompt?: string }[];
  stage?: string;
  sessionId?: string;
  provider?: "claude-agent" | "pollinations" | "gemini" | "cloudflare" | "openai-compat";
}

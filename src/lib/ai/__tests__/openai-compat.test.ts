import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http from "node:http";
import { runOpenAICompat } from "../openai-compat";
import type { ToolContext } from "../tools";
import type { ChatEvent } from "../events";
import { createSampleGenome } from "@/lib/genome/defaults";
import { ProviderSettingsSchema } from "@/lib/providers/types";

/** A tiny OpenAI-compatible mock: first turn requests a tool call via SSE, second turn answers in text. */
let server: http.Server;
let baseUrl = "";
const requests: unknown[] = [];

function sse(res: http.ServerResponse, chunks: unknown[]) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.url?.endsWith("/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "text-embedding-3" }, { id: "gpt-mock" }] }));
        return;
      }
      const parsed = JSON.parse(body);
      requests.push(parsed);
      const hasToolResult = parsed.messages.some((m: { role: string }) => m.role === "tool");
      if (!hasToolResult) {
        sse(res, [
          { choices: [{ delta: { content: "Checking " } }] },
          { choices: [{ delta: { content: "contrast…" } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "check_contrast", arguments: '{"foreground":"#000000",' } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"background":"#ffffff"}' } }] }, finish_reason: "tool_calls" }] },
        ]);
      } else {
        sse(res, [{ choices: [{ delta: { content: "Ratio is 21:1." } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }]);
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}/v1`;
});

afterAll(() => server.close());

describe("OpenAI-compatible tool loop", () => {
  it("streams text, executes the requested tool, and continues to a final answer", async () => {
    const events: ChatEvent[] = [];
    const ctx: ToolContext = { genome: createSampleGenome(), assets: [], settings: ProviderSettingsSchema.parse({}), emit: (e) => events.push(e) };
    await runOpenAICompat({ baseUrl, model: "", providerId: "mock", messages: [{ role: "user", content: "Check black on white" }], ctx });

    const text = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toContain("Checking contrast…");
    expect(text).toContain("Ratio is 21:1.");
    const start = events.find((e) => e.type === "tool-start") as { name: string; args: { foreground: string } };
    expect(start.name).toBe("check_contrast");
    expect(start.args.foreground).toBe("#000000");
    const end = events.find((e) => e.type === "tool-end") as { result?: string; error?: string };
    expect(end.error).toBeUndefined();
    expect(String(end.result)).toContain('"aaNormal":true');
    const done = events.find((e) => e.type === "done") as { model: string };
    expect(done.model).toBe("gpt-mock"); // auto-resolved, skipping the embedding model

    // The second request must carry the assistant tool_calls turn and the tool result.
    const second = requests[1] as { messages: { role: string; tool_call_id?: string }[]; tools?: unknown[] };
    expect(second.messages.some((m) => m.role === "tool" && m.tool_call_id === "call_1")).toBe(true);
    expect(Array.isArray(second.tools)).toBe(true);
    const sys = (requests[0] as { messages: { role: string; content: string }[] }).messages[0];
    expect(sys.role).toBe("system");
    expect(sys.content).toContain("Creative Director");
  });
});

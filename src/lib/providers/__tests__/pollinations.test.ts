import { describe, it, expect, vi, afterEach } from "vitest";
import { pollinationsImage } from "../image/pollinations";
import { generateImageWithFallback } from "../image";
import { ProviderSettingsSchema, parseSettingsHeader, withEnvFallbacks } from "../types";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const settings = ProviderSettingsSchema.parse({});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Pollinations image provider", () => {
  it("builds the gen.pollinations.ai URL with model, size, seed and nologo, and decodes the JPEG", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JPEG, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    });
    const img = await pollinationsImage.generate({ prompt: "a steaming cup", width: 1024, height: 576, seed: 42 }, settings);
    const u = new URL(calls[0]);
    expect(u.origin + u.pathname).toBe("https://gen.pollinations.ai/image/a%20steaming%20cup");
    expect(u.searchParams.get("model")).toBe("flux");
    expect(u.searchParams.get("width")).toBe("1024");
    expect(u.searchParams.get("height")).toBe("576");
    expect(u.searchParams.get("seed")).toBe("42");
    expect(u.searchParams.get("nologo")).toBe("true");
    expect(u.searchParams.has("key")).toBe(false);
    expect(img.mime).toBe("image/jpeg");
    expect(img.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(img.provider).toBe("pollinations");
  });

  it("retries once after a 429 honouring Retry-After", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429, headers: { "retry-after": "1" } });
      return new Response(JPEG, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    });
    const p = pollinationsImage.generate({ prompt: "x", width: 512, height: 512 }, settings);
    await vi.advanceTimersByTimeAsync(1100);
    const img = await p;
    expect(n).toBe(2);
    expect(img.mime).toBe("image/jpeg");
  });

  it("falls through the chain and reports every attempt when providers fail", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 500, headers: { "Content-Type": "application/json" } }));
    const r = await generateImageWithFallback({ prompt: "x", width: 512, height: 512 }, settings, "auto");
    expect(r.image).toBeNull();
    expect(r.attempts.map((a) => a.provider)).toEqual(["pollinations", "cloudflare", "gemini", "hf-space"]);
    expect(r.attempts[0].error).toContain("nope");
    expect(r.attempts[1].error).toBe("not configured");
  });
});

describe("settings header", () => {
  it("parses base64 JSON and tolerates garbage", () => {
    const good = Buffer.from(JSON.stringify({ providers: { gemini: { apiKey: "k" } }, image: { order: ["gemini"] } })).toString("base64");
    expect(parseSettingsHeader(good).providers.gemini.apiKey).toBe("k");
    expect(parseSettingsHeader(good).image.order).toEqual(["gemini"]);
    expect(parseSettingsHeader("%%%not-base64").image.order.length).toBe(4);
    expect(parseSettingsHeader(Buffer.from("[1,2,3]").toString("base64")).providers.pollinations.imageModel).toBe("flux");
    expect(parseSettingsHeader(null).assistant.provider).toBe("claude-agent");
  });

  it("fills empty fields from the environment", () => {
    process.env.GEMINI_API_KEY = "env-key";
    const s = withEnvFallbacks(ProviderSettingsSchema.parse({}));
    expect(s.providers.gemini.apiKey).toBe("env-key");
    delete process.env.GEMINI_API_KEY;
  });
});

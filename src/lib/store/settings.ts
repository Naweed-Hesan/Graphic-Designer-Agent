"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AssistantProviderId = "claude-agent" | "pollinations" | "gemini" | "cloudflare" | "openai-compat";
export type ImageProviderId = "pollinations" | "cloudflare" | "gemini" | "hf-space";
export type VideoProviderId = "pollinations" | "hf-space";

export interface ProviderSettings {
  pollinations: { apiKey: string; imageModel: string; textModel: string; videoModel: string };
  cloudflare: { accountId: string; apiToken: string; imageModel: string; textModel: string };
  gemini: { apiKey: string; imageModel: string; textModel: string };
  huggingface: { token: string; imageSpace: string; videoSpace: string };
  openaiCompat: { baseUrl: string; apiKey: string; model: string; label: string };
  claude: { model: string };
}

export interface Settings {
  providers: ProviderSettings;
  assistant: { provider: AssistantProviderId };
  image: { order: ImageProviderId[] };
  video: { order: VideoProviderId[] };
  theme: "dark" | "light";
  assistantOpen: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  providers: {
    pollinations: { apiKey: "", imageModel: "flux", textModel: "openai", videoModel: "" },
    cloudflare: { accountId: "", apiToken: "", imageModel: "@cf/black-forest-labs/flux-1-schnell", textModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
    gemini: { apiKey: "", imageModel: "gemini-2.5-flash-image", textModel: "gemini-2.5-flash" },
    huggingface: { token: "", imageSpace: "black-forest-labs/FLUX.1-schnell", videoSpace: "Lightricks/ltx-2-distilled" },
    openaiCompat: { baseUrl: "http://localhost:11434/v1", apiKey: "", model: "", label: "Ollama / any OpenAI-compatible" },
    claude: { model: "" },
  },
  assistant: { provider: "claude-agent" },
  image: { order: ["pollinations", "cloudflare", "gemini", "hf-space"] },
  video: { order: ["pollinations", "hf-space"] },
  theme: "dark",
  assistantOpen: true,
  onboarded: false,
};

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  setProvider: <K extends keyof ProviderSettings>(key: K, patch: Partial<ProviderSettings[K]>) => void;
  toggleTheme: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setProvider: (key, patch) =>
        set({ providers: { ...get().providers, [key]: { ...get().providers[key], ...patch } } }),
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("light", next === "light");
        try {
          localStorage.setItem("ligature:theme", next);
        } catch {}
        set({ theme: next });
      },
    }),
    {
      name: "ligature:settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...p,
          providers: Object.fromEntries(
            Object.entries(DEFAULT_SETTINGS.providers).map(([k, v]) => [k, { ...v, ...(p.providers?.[k as keyof ProviderSettings] ?? {}) }]),
          ) as ProviderSettings,
          image: { order: p.image?.order ?? DEFAULT_SETTINGS.image.order },
          video: { order: p.video?.order ?? DEFAULT_SETTINGS.video.order },
          assistant: { ...DEFAULT_SETTINGS.assistant, ...(p.assistant ?? {}) },
        };
      },
    },
  ),
);

/** Serialised for request headers; the server never persists these. */
export function settingsHeader(): Record<string, string> {
  const s = useSettings.getState();
  const payload = { providers: s.providers, assistant: s.assistant, image: s.image, video: s.video };
  // base64 keeps non-ASCII safe in headers
  const json = JSON.stringify(payload);
  const b64 = typeof window !== "undefined" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString("base64");
  return { "x-ligature-settings": b64 };
}

export function providerConfigured(s: Settings, id: ImageProviderId | VideoProviderId | AssistantProviderId): boolean {
  const p = s.providers;
  switch (id) {
    case "pollinations":
      return true; // anonymous access works; a key unlocks more
    case "cloudflare":
      return Boolean(p.cloudflare.accountId && p.cloudflare.apiToken);
    case "gemini":
      return Boolean(p.gemini.apiKey);
    case "hf-space":
      return true; // anonymous ZeroGPU quota; token improves it
    case "openai-compat":
      return Boolean(p.openaiCompat.baseUrl && p.openaiCompat.model);
    case "claude-agent":
      return true; // determined server-side
  }
}

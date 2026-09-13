"use client";
import * as React from "react";
import { Check, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, Field, Input, Button, Badge, Tabs } from "@/components/ui";
import { useSettings, type AssistantProviderId, type ImageProviderId, type VideoProviderId } from "@/lib/store/settings";
import { fetchAiStatus, fetchModels } from "@/lib/api";

type Tab = "assistant" | "image" | "video" | "keys";

const ASSISTANT_OPTIONS: { id: AssistantProviderId; label: string; note: string }[] = [
  { id: "claude-agent", label: "Claude (Agent SDK on your Claude Code login)", note: "Uses your local Claude Code sign-in (Pro/Max) or ANTHROPIC_API_KEY. Best quality; runs the full tool loop." },
  { id: "pollinations", label: "Pollinations (free, no key)", note: "Free hosted models with function calling. A free key from enter.pollinations.ai raises limits." },
  { id: "gemini", label: "Google Gemini (free API key)", note: "Generous free tier for text. Get a key at aistudio.google.com." },
  { id: "cloudflare", label: "Cloudflare Workers AI (free)", note: "10,000 neurons/day. Llama models with tool calling." },
  { id: "openai-compat", label: "Any OpenAI-compatible (Ollama, Groq, OpenRouter…)", note: "Point at a local model for a fully offline assistant." },
];

const IMAGE_LABELS: Record<ImageProviderId, string> = {
  pollinations: "Pollinations — free, no key (FLUX)",
  cloudflare: "Cloudflare Workers AI — ~170 FLUX images/day free",
  gemini: "Gemini — image generation & editing (free tier varies)",
  "hf-space": "Hugging Face Space — free GPU queue (slow, reliable)",
};
const VIDEO_LABELS: Record<VideoProviderId, string> = {
  pollinations: "Pollinations — text/image-to-video (free weekly Pollen with a key)",
  "hf-space": "Hugging Face Space — LTX-2 / Wan, free GPU queue",
};

function Reorder<T extends string>({ order, labels, onChange }: { order: T[]; labels: Record<T, string>; onChange: (o: T[]) => void }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <ol className="flex flex-col gap-1.5">
      {order.map((id, i) => (
        <li key={id} className="surface-2 px-3 py-2 flex items-center gap-3 text-sm">
          <span className="text-fg-subtle w-4 text-right">{i + 1}</span>
          <span className="flex-1">{labels[id]}</span>
          <button className="text-fg-subtle hover:text-fg text-xs px-1 cursor-pointer" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">▲</button>
          <button className="text-fg-subtle hover:text-fg text-xs px-1 cursor-pointer" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">▼</button>
        </li>
      ))}
    </ol>
  );
}

function ModelPicker({ provider, kind, value, onChange, placeholder }: { provider: string; kind: "image" | "video" | "text"; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [models, setModels] = React.useState<{ id: string; label?: string }[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const m = await fetchModels(provider, kind);
      setModels(m);
      if (!m.length) toast.message("No models returned — check the provider's key");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex gap-2">
      <Input list={`models-${provider}-${kind}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <datalist id={`models-${provider}-${kind}`}>{(models ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</datalist>
      <Button variant="secondary" size="md" onClick={load} loading={loading} title="Load available models">
        <RefreshCw className="h-3.5 w-3.5" /> Models
      </Button>
    </div>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const [tab, setTab] = React.useState<Tab>("assistant");
  const [status, setStatus] = React.useState<Awaited<ReturnType<typeof fetchAiStatus>> | null>(null);
  const [probing, setProbing] = React.useState(false);

  React.useEffect(() => {
    if (open) fetchAiStatus(false).then(setStatus).catch(() => {});
  }, [open]);

  const probe = async () => {
    setProbing(true);
    try {
      const r = await fetchAiStatus(true);
      setStatus(r);
      if (r.claude?.available) toast.success(`Claude reachable (${r.claude.model}, ${r.claude.apiKeySource})`);
      else toast.error(r.claude?.error || "Claude not reachable");
    } finally {
      setProbing(false);
    }
  };

  const p = s.providers;
  return (
    <Dialog open={open} onClose={onClose} title="Providers & settings" description="Keys are stored only in this browser and sent to your own local server per request. Nothing is persisted server-side." wide>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "assistant", label: "Assistant" },
          { value: "image", label: "Images" },
          { value: "video", label: "Video" },
          { value: "keys", label: "Keys" },
        ]}
        className="mb-5"
      />

      {tab === "assistant" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            {ASSISTANT_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => s.set({ assistant: { provider: o.id } })}
                className={`text-left surface-2 px-4 py-3 transition-colors cursor-pointer ${s.assistant.provider === o.id ? "border-accent bg-accent-soft/40" : "hover:border-line-strong"}`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {s.assistant.provider === o.id ? <Check className="h-4 w-4 text-accent" /> : <span className="h-4 w-4" />}
                  {o.label}
                </div>
                <div className="text-xs text-fg-muted mt-0.5 pl-6">{o.note}</div>
              </button>
            ))}
          </div>
          {s.assistant.provider === "claude-agent" && (
            <div className="inset p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" /> Claude connection
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    {status?.claude ? (
                      status.claude.available ? `Reachable · ${status.claude.model} · auth: ${status.claude.apiKeySource} · Claude Code ${status.claude.version}` : `Not reachable: ${status.claude.error}`
                    ) : (
                      "Not tested yet. Sign in with `claude` in a terminal (Pro/Max) or set ANTHROPIC_API_KEY, then test."
                    )}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={probe} loading={probing}>
                  Test connection
                </Button>
              </div>
              <Field label="Model override" hint="optional, e.g. opus, sonnet">
                <Input value={p.claude.model} onChange={(e) => s.setProvider("claude", { model: e.target.value })} placeholder="default from Claude Code" />
              </Field>
            </div>
          )}
          {s.assistant.provider === "pollinations" && (
            <Field label="Text model" hint="leave empty to auto-pick">
              <ModelPicker provider="pollinations" kind="text" value={p.pollinations.textModel} onChange={(v) => s.setProvider("pollinations", { textModel: v })} placeholder="auto" />
            </Field>
          )}
          {s.assistant.provider === "gemini" && (
            <Field label="Gemini text model">
              <ModelPicker provider="gemini" kind="text" value={p.gemini.textModel} onChange={(v) => s.setProvider("gemini", { textModel: v })} placeholder="gemini-2.5-flash" />
            </Field>
          )}
          {s.assistant.provider === "cloudflare" && (
            <Field label="Workers AI text model">
              <ModelPicker provider="cloudflare" kind="text" value={p.cloudflare.textModel} onChange={(v) => s.setProvider("cloudflare", { textModel: v })} placeholder="@cf/meta/llama-3.3-70b-instruct-fp8-fast" />
            </Field>
          )}
          {s.assistant.provider === "openai-compat" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Base URL" hint="ends with /v1">
                <Input value={p.openaiCompat.baseUrl} onChange={(e) => s.setProvider("openaiCompat", { baseUrl: e.target.value })} placeholder="http://localhost:11434/v1" />
              </Field>
              <Field label="API key" hint="optional">
                <Input type="password" value={p.openaiCompat.apiKey} onChange={(e) => s.setProvider("openaiCompat", { apiKey: e.target.value })} />
              </Field>
              <Field label="Model">
                <ModelPicker provider="openai-compat" kind="text" value={p.openaiCompat.model} onChange={(v) => s.setProvider("openaiCompat", { model: v })} placeholder="llama3.2" />
              </Field>
              <Field label="Label">
                <Input value={p.openaiCompat.label} onChange={(e) => s.setProvider("openaiCompat", { label: e.target.value })} />
              </Field>
            </div>
          )}
        </div>
      )}

      {tab === "image" && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="label mb-2">Fallback order</div>
            <p className="text-xs text-fg-muted mb-2">Ligature tries providers top to bottom until one succeeds. Unconfigured ones are skipped.</p>
            <Reorder order={s.image.order} labels={IMAGE_LABELS} onChange={(order) => s.set({ image: { order } })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Pollinations image model">
              <ModelPicker provider="pollinations" kind="image" value={p.pollinations.imageModel} onChange={(v) => s.setProvider("pollinations", { imageModel: v })} placeholder="flux" />
            </Field>
            <Field label="Cloudflare image model">
              <ModelPicker provider="cloudflare" kind="image" value={p.cloudflare.imageModel} onChange={(v) => s.setProvider("cloudflare", { imageModel: v })} placeholder="@cf/black-forest-labs/flux-1-schnell" />
            </Field>
            <Field label="Gemini image model">
              <ModelPicker provider="gemini" kind="image" value={p.gemini.imageModel} onChange={(v) => s.setProvider("gemini", { imageModel: v })} placeholder="gemini-2.5-flash-image" />
            </Field>
            <Field label="Hugging Face image Space" hint="owner/space">
              <Input value={p.huggingface.imageSpace} onChange={(e) => s.setProvider("huggingface", { imageSpace: e.target.value })} placeholder="black-forest-labs/FLUX.1-schnell" />
            </Field>
          </div>
        </div>
      )}

      {tab === "video" && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="label mb-2">Fallback order</div>
            <Reorder order={s.video.order} labels={VIDEO_LABELS} onChange={(order) => s.set({ video: { order } })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Pollinations video model" hint="empty = provider default">
              <ModelPicker provider="pollinations" kind="video" value={p.pollinations.videoModel} onChange={(v) => s.setProvider("pollinations", { videoModel: v })} placeholder="auto" />
            </Field>
            <Field label="Hugging Face video Space" hint="owner/space">
              <Input value={p.huggingface.videoSpace} onChange={(e) => s.setProvider("huggingface", { videoSpace: e.target.value })} placeholder="Lightricks/ltx-2-distilled" />
            </Field>
          </div>
          <p className="text-xs text-fg-muted">
            The Motion lab also renders logo animations entirely in your browser (MP4/WebM/GIF) — no provider needed.
          </p>
        </div>
      )}

      {tab === "keys" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KeyCard title="Pollinations" href="https://enter.pollinations.ai" note="Optional. Anonymous use works for FLUX images; a free key adds Pollen for text and video models." configured={Boolean(p.pollinations.apiKey) || Boolean(status?.env?.pollinations)}>
            <Input type="password" value={p.pollinations.apiKey} onChange={(e) => s.setProvider("pollinations", { apiKey: e.target.value })} placeholder="sk_…" />
          </KeyCard>
          <KeyCard title="Cloudflare Workers AI" href="https://dash.cloudflare.com/?to=/:account/ai/workers-ai" note="Free 10,000 neurons/day. Create an API token with Workers AI read/edit." configured={Boolean(p.cloudflare.accountId && p.cloudflare.apiToken) || Boolean(status?.env?.cloudflare)}>
            <Input value={p.cloudflare.accountId} onChange={(e) => s.setProvider("cloudflare", { accountId: e.target.value })} placeholder="Account ID" />
            <Input type="password" value={p.cloudflare.apiToken} onChange={(e) => s.setProvider("cloudflare", { apiToken: e.target.value })} placeholder="API token" />
          </KeyCard>
          <KeyCard title="Google Gemini" href="https://aistudio.google.com/apikey" note="Free API key from AI Studio. Text is free; image generation free-tier availability varies by model." configured={Boolean(p.gemini.apiKey) || Boolean(status?.env?.gemini)}>
            <Input type="password" value={p.gemini.apiKey} onChange={(e) => s.setProvider("gemini", { apiKey: e.target.value })} placeholder="AIza…" />
          </KeyCard>
          <KeyCard title="Hugging Face" href="https://huggingface.co/settings/tokens" note="Optional read token. Raises your free ZeroGPU quota on Spaces." configured={Boolean(p.huggingface.token) || Boolean(status?.env?.huggingface)}>
            <Input type="password" value={p.huggingface.token} onChange={(e) => s.setProvider("huggingface", { token: e.target.value })} placeholder="hf_…" />
          </KeyCard>
          <div className="md:col-span-2 text-xs text-fg-muted">
            Prefer environment variables? Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>; values there are used when a field above is empty.
          </div>
        </div>
      )}
    </Dialog>
  );
}

function KeyCard({ title, href, note, configured, children }: { title: string; href: string; note: string; configured: boolean; children: React.ReactNode }) {
  return (
    <div className="surface-2 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{title}</div>
        <div className="flex items-center gap-2">
          <Badge tone={configured ? "success" : "neutral"}>{configured ? "configured" : "not set"}</Badge>
          <a href={href} target="_blank" rel="noreferrer" className="text-fg-subtle hover:text-fg" title="Get a key">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <p className="text-xs text-fg-muted">{note}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

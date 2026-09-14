"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Send, Square, Trash2, X, Wrench, ChevronDown, Sparkles, AlertTriangle } from "lucide-react";
import { Button, Spinner, Badge } from "@/components/ui";
import { useProject, assetUrl } from "@/lib/store/project";
import { useSettings, type AssistantProviderId } from "@/lib/store/settings";
import { useAssistant } from "@/lib/store/assistant";
import type { ChatMessage } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { StageId } from "@/lib/genome/schema";
import { STAGE_BY_ID } from "@/lib/genome/stages";

const QUICK: Record<StageId, string[]> = {
  brief: ["Turn my notes into a complete creative brief", "What questions should I ask this client?", "Summarise the brief in three sentences"],
  strategy: ["Propose positioning, values and an archetype from the brief", "Give me five tagline options with rationale", "Define the tone of voice with dos and don'ts"],
  logo: ["Describe three logo concepts rooted in the strategy", "Generate 2 logo-concept images", "Write usage rules and don'ts for the logo"],
  color: ["Build a palette from the strategy and check contrast", "Make the palette more premium and restrained", "Explain the palette rationale for the guidelines"],
  type: ["Pair a display and body typeface for this brand", "Suggest a more expressive display face", "Explain the typographic rationale"],
  imagery: ["Define our imagery style (medium, lighting, composition, mood)", "Generate a hero image for the website", "Generate a seamless brand pattern"],
  motion: ["Write motion principles that fit the personality", "Which logo animation preset suits us and why?", "Draft a 6-second brand video prompt"],
  mockups: ["Which applications matter most for this client?", "Suggest packaging directions", "Describe the social template system"],
  guidelines: ["Write the brand story for the guidelines intro", "Draft the logo usage section", "Review the whole system for coherence"],
  export: ["What should be in the handoff for a developer?", "List the assets a printer needs", "Summarise the identity in one paragraph"],
};

export function AssistantPanel({ stage, onClose }: { stage: StageId; onClose?: () => void }) {
  const projectId = useProject((s) => s.genome?.id ?? "");
  const provider = useSettings((s) => s.assistant.provider);
  const setSettings = useSettings((s) => s.set);
  const thread = useAssistant((s) => (projectId ? s.threads[projectId] : undefined));
  const busy = useAssistant((s) => Boolean(projectId && s.busy[projectId]));
  const status = useAssistant((s) => (projectId ? s.status[projectId] : null) ?? null);
  const load = useAssistant((s) => s.load);
  const send = useAssistant((s) => s.send);
  const stop = useAssistant((s) => s.stop);
  const clear = useAssistant((s) => s.clear);
  const [input, setInput] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (projectId) load(projectId);
  }, [projectId, load]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [thread?.messages, status]);

  const submit = (text: string) => {
    if (!projectId || busy || !text.trim()) return;
    setInput("");
    void send(projectId, text, stage);
  };

  const onClear = () => {
    if (!thread) return;
    if (thread.messages.length && !confirm("Clear this conversation?")) return;
    clear(projectId);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-14 shrink-0 border-b border-line flex items-center gap-2 px-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <div className="font-medium text-sm">Creative Director</div>
        <select
          value={provider}
          onChange={(e) => setSettings({ assistant: { provider: e.target.value as AssistantProviderId } })}
          className="ml-1 text-[11px] bg-bg-inset border border-line rounded-md px-1.5 h-6 text-fg-muted max-w-[150px]"
          title="Assistant provider"
          aria-label="Assistant provider"
        >
          <option value="claude-agent">Claude (Agent SDK)</option>
          <option value="pollinations">Pollinations (free)</option>
          <option value="gemini">Gemini</option>
          <option value="cloudflare">Cloudflare</option>
          <option value="openai-compat">OpenAI-compatible</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onClear} title="Clear conversation" aria-label="Clear conversation">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close" aria-label="Close Creative Director">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {!thread?.messages.length && (
          <div className="text-sm text-fg-muted">
            <p className="mb-3">I edit the Brand Genome directly: palette, type, strategy, imagery and stage status all update live in the studio. Ask for options, critique, or tell me to just do it.</p>
            <div className="label mb-1.5">Try on the {STAGE_BY_ID[stage].label} stage</div>
            <div className="flex flex-col gap-1.5">
              {QUICK[stage].map((q) => (
                <button key={q} onClick={() => submit(q)} className="text-left text-[13px] surface-2 px-3 py-2 hover:border-line-strong cursor-pointer">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {thread?.messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {status && (
          <div className="flex items-center gap-2 text-xs text-fg-muted px-1">
            <Spinner className="h-3 w-3" /> {status}
          </div>
        )}
      </div>

      <form
        className="shrink-0 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="inset flex items-end gap-2 p-2 focus-within:border-line-strong">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={2}
            placeholder={`Ask about ${STAGE_BY_ID[stage].label.toLowerCase()}… (Enter to send)`}
            aria-label="Message the Creative Director"
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-fg-subtle leading-relaxed max-h-40"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => stop(projectId)} title="Stop" aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} title="Send" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Message({ m }: { m: ChatMessage }) {
  const assets = useProject((s) => s.assets);
  if (m.role === "user") {
    return (
      <div className="self-end max-w-[85%] rounded-xl rounded-br-sm bg-accent-soft px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
    );
  }
  const images = (m.images ?? []).map((id) => assets.find((a) => a.id === id)).filter(Boolean);
  return (
    <div className="self-start max-w-[95%] flex flex-col gap-2">
      {m.tools?.map((t) => <ToolCard key={t.id} t={t} />)}
      {m.content ? (
        <div className="prose-sm text-sm leading-relaxed">
          <ReactMarkdown>{m.content}</ReactMarkdown>
        </div>
      ) : null}
      {images.length ? (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a!.id} src={assetUrl(a)} alt={a!.name} className="rounded-md border border-line w-full aspect-square object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolCard({ t }: { t: NonNullable<ChatMessage["tools"]>[number] }) {
  const [open, setOpen] = React.useState(false);
  const label = t.name.replace(/_/g, " ");
  return (
    <div className={cn("surface-2 text-xs overflow-hidden", t.status === "error" && "border-danger/50")}>
      <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer" onClick={() => setOpen((o) => !o)}>
        {t.status === "running" ? <Spinner className="h-3 w-3" /> : t.status === "error" ? <AlertTriangle className="h-3 w-3 text-danger" /> : <Wrench className="h-3 w-3 text-fg-subtle" />}
        <span className="font-medium">{label}</span>
        <Badge tone={t.status === "done" ? "success" : t.status === "error" ? "danger" : "warning"} className="ml-auto">
          {t.status}
        </Badge>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-line px-2.5 py-2 font-mono text-[11px] text-fg-muted whitespace-pre-wrap break-words max-h-48 overflow-auto">
          <div className="text-fg-subtle mb-1">args</div>
          {JSON.stringify(t.args, null, 1)}
          {t.result !== undefined && (
            <>
              <div className="text-fg-subtle mt-2 mb-1">result</div>
              {typeof t.result === "string" ? t.result : JSON.stringify(t.result, null, 1)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

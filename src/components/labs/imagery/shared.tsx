"use client";
import * as React from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { assetUrl, useProject } from "@/lib/store/project";
import type { Asset } from "@/lib/db";
import { cn } from "@/lib/utils";
import { type AttemptInfo, ORIGIN_TAGS, attemptErrorText, formatMs, purposeFromTags } from "@/lib/imagery/generation";
import { PURPOSE_BY_ID } from "@/lib/imagery/presets";

const EMPTY_IDS: string[] = [];

/** Blob-backed image — next/image cannot serve object URLs, so a plain <img> is deliberate here. */
export function AssetImage({ asset, className, alt }: { asset: Asset; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={assetUrl(asset)} alt={alt ?? asset.name} className={className} loading="lazy" decoding="async" draggable={false} />;
}

export function useReferenceIds(): string[] {
  return useProject((s) => s.genome?.visual.imagery.referenceAssetIds ?? EMPTY_IDS);
}

export function isImageAsset(a: Asset): boolean {
  return a.kind === "image" || a.kind === "svg";
}

/** Imagery-stage images (optionally with logo-stage concepts), newest first. */
export function useImageryImages(includeLogo = false): Asset[] {
  const assets = useProject((s) => s.assets);
  return assets.filter((a) => isImageAsset(a) && (a.stage === "imagery" || (includeLogo && a.stage === "logo")));
}

export function setStyleReferences(ids: string[], on: boolean) {
  if (!ids.length) return;
  const { update } = useProject.getState();
  const n = ids.length;
  update(
    (g) => {
      const cur = g.visual.imagery.referenceAssetIds;
      g.visual.imagery.referenceAssetIds = on ? [...cur, ...ids.filter((id) => !cur.includes(id))] : cur.filter((id) => !ids.includes(id));
    },
    { summary: on ? (n === 1 ? "Added a style reference" : `Added ${n} style references`) : n === 1 ? "Removed a style reference" : `Removed ${n} style references`, stage: "imagery" },
  );
}

/** First image work flips the stage from "todo" to "in-progress". */
export function markImageryInProgress() {
  const { genome, setStage } = useProject.getState();
  if (genome && (genome.stages.imagery ?? "todo") === "todo") setStage("imagery", "in-progress");
}

export function purposeLabel(asset: Asset): string | null {
  const p = purposeFromTags(asset.tags);
  return p ? PURPOSE_BY_ID[p].label : null;
}

export function originOf(asset: Asset): string | null {
  return asset.tags.find((t) => (ORIGIN_TAGS as readonly string[]).includes(t)) ?? null;
}

export function ReferenceStrip({ onOpen, className }: { onOpen?: (id: string) => void; className?: string }) {
  const refs = useReferenceIds();
  const assets = useProject((s) => s.assets);
  const items = refs.map((id) => assets.find((a) => a.id === id)).filter((a): a is Asset => Boolean(a));
  return (
    <div className={cn("surface px-4 py-3 flex items-center gap-4", className)}>
      <div className="shrink-0 w-28">
        <div className="label">Style references</div>
        <div className="text-xs text-fg-muted mt-0.5">{items.length ? `${items.length} pinned` : "None pinned"}</div>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2.5 overflow-x-auto py-1 pr-1">
        {items.length ? (
          items.map((a) => (
            <div key={a.id} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => onOpen?.(a.id)}
                className="block h-14 w-14 rounded-md overflow-hidden border border-line bg-bg-inset cursor-pointer hover:border-line-strong"
                title={a.name}
              >
                <AssetImage asset={a} className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => setStyleReferences([a.id], false)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-bg-elev border border-line text-fg-subtle hover:text-fg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex items-center justify-center cursor-pointer"
                aria-label={`Unpin ${a.name}`}
                title="Unpin"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-xs text-fg-subtle">Pin images from the Gallery (“Set as style reference”) to keep the direction visible here and to the Creative Director.</p>
        )}
      </div>
    </div>
  );
}

export function SuggestionChips({
  items,
  isActive,
  onPick,
  className,
}: {
  items: readonly string[];
  isActive?: (s: string) => boolean;
  onPick: (s: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {items.map((s) => {
        const active = isActive?.(s) ?? false;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            aria-pressed={active}
            title={s}
            className={cn(
              "inline-flex items-center max-w-full min-w-0 rounded-full border px-2 h-6 text-[11px] leading-none transition-colors cursor-pointer",
              active ? "border-accent/60 bg-accent-soft text-fg" : "border-line text-fg-muted hover:text-fg hover:border-line-strong",
            )}
          >
            {active ? <Check className="h-3 w-3 mr-1 shrink-0" /> : null}
            <span className="truncate">{s}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AttemptList({ attempts, className }: { attempts: AttemptInfo[]; className?: string }) {
  if (!attempts.length) return null;
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {attempts.map((a, i) => (
        <li key={`${a.provider}-${i}`} className="flex items-start gap-2 text-xs min-w-0">
          {a.ok ? <Check className="h-3.5 w-3.5 text-success shrink-0 mt-px" /> : <CircleAlert className="h-3.5 w-3.5 text-danger shrink-0 mt-px" />}
          <span className="font-mono text-fg shrink-0">{a.provider}</span>
          <span className="text-fg-muted break-words min-w-0">{a.ok ? "ok" : attemptErrorText(a)}</span>
          {a.ms != null ? <span className="ml-auto text-fg-subtle font-mono shrink-0">{formatMs(a.ms)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function PromptNotes({ notes, aspect }: { notes: string[]; aspect?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {notes.map((n) => (
        <Badge key={n} tone="accent">
          {n}
        </Badge>
      ))}
      {!notes.length ? <Badge tone="warning">No Genome conditioning yet</Badge> : null}
      {aspect ? <Badge>aspect {aspect}</Badge> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex items-center rounded-md border border-line bg-bg-inset p-0.5 h-9", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full min-w-8 px-2.5 rounded text-[13px] font-medium transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5",
            value === o.value ? "bg-bg-elev text-fg shadow-sm" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TileButton({
  title,
  onClick,
  active,
  children,
  className,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "h-7 w-7 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
        active ? "bg-accent text-accent-fg border-accent" : "bg-bg-elev/90 border-line text-fg-muted hover:text-fg hover:border-line-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

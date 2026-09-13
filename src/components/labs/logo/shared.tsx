"use client";
import * as React from "react";
import { Download } from "lucide-react";
import type { Genome } from "@/lib/genome/schema";
import type { Asset } from "@/lib/db";
import { useProject } from "@/lib/store/project";
import { toResponsiveSvg } from "@/lib/logo/svg";
import { cn, downloadBlob, slugify } from "@/lib/utils";
import { Button } from "@/components/ui";

export const CONCEPT_TAG = "logo-concept";
export const VARIANT_TAG = "logo-variant";
export const MARK_TAG = "logo-mark";
export const WORDMARK_TAG = "logo-wordmark";

/** Inline SVG preview that scales to its container (inline so live-text wordmarks use loaded web fonts). */
export function SvgView({ svg, className, style, title }: { svg: string; className?: string; style?: React.CSSProperties; title?: string }) {
  const html = React.useMemo(() => toResponsiveSvg(svg), [svg]);
  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden [&>svg]:block [&>svg]:max-h-full [&>svg]:max-w-full", className)}
      style={style}
      title={title}
      role="img"
      aria-label={title ?? "Logo preview"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** A logo rendered on a solid background swatch with a caption. */
export function PreviewCard({ svg, background, label, className, height = "h-40", pad = "p-6", children }: { svg: string; background: string; label: React.ReactNode; className?: string; height?: string; pad?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("surface-2 overflow-hidden", className)}>
      <div className={cn("w-full", height, pad)} style={{ background }}>
        <SvgView svg={svg} className="h-full w-full" />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] text-fg-muted border-t border-line">
        <span className="truncate">{label}</span>
        {children}
      </div>
    </div>
  );
}

export const NEUTRAL_SWATCHES = [
  { name: "Near black", hex: "#111111" },
  { name: "White", hex: "#ffffff" },
];

/** Brand palette as clickable swatches plus a native colour picker. */
export function PaletteChips({ genome, value, onChange, className, custom = true, neutrals = true }: { genome: Genome; value: string; onChange: (hex: string) => void; className?: string; custom?: boolean; neutrals?: boolean }) {
  const swatches = [...genome.visual.palette.colors.map((c) => ({ name: c.name, hex: c.hex })), ...(neutrals ? NEUTRAL_SWATCHES : [])];
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {swatches.map((c) => {
        const active = value.toLowerCase() === c.hex.toLowerCase();
        return (
          <button
            key={`${c.name}-${c.hex}`}
            type="button"
            title={`${c.name} · ${c.hex.toUpperCase()}`}
            aria-label={`${c.name} ${c.hex}`}
            aria-pressed={active}
            onClick={() => onChange(c.hex)}
            className={cn("h-6 w-6 rounded-full border transition-transform cursor-pointer", active ? "ring-2 ring-accent ring-offset-2 ring-offset-bg-elev border-transparent" : "border-line-strong hover:scale-110")}
            style={{ background: c.hex }}
          />
        );
      })}
      {custom ? (
        <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-subtle ml-1 cursor-pointer" title="Custom colour">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" className="h-6 w-7 rounded border border-line bg-transparent p-0 cursor-pointer" />
          <span className="font-mono">{value.toUpperCase()}</span>
        </label>
      ) : null}
    </div>
  );
}

/** Concept images (AI or uploaded) for this project. */
export function useLogoConcepts(): Asset[] {
  const assets = useProject((s) => s.assets);
  return React.useMemo(() => assets.filter((a) => a.stage === "logo" && a.kind === "image" && a.tags.includes(CONCEPT_TAG)), [assets]);
}

export function downloadSvg(svg: string, name: string) {
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${slugify(name)}.svg`);
}

export function DownloadSvgButton({ svg, name, label = "SVG" }: { svg: string; name: string; label?: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => downloadSvg(svg, name)} title="Download SVG">
      <Download className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Small labelled control block used across the lab's side panels. */
export function Control({ label, hint, children, className }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-fg-muted">{label}</span>
        {hint ? <span className="text-[11px] text-fg-subtle font-mono">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "success"; children: React.ReactNode; className?: string }) {
  const tones = { info: "border-info/30 bg-info/10 text-fg", warning: "border-warning/30 bg-warning/10 text-fg", success: "border-success/30 bg-success/10 text-fg" };
  return <div className={cn("rounded-md border px-3 py-2 text-[13px] leading-relaxed", tones[tone], className)}>{children}</div>;
}

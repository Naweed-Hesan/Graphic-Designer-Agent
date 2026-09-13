"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { Button, Card, SectionHeader, Spinner } from "@/components/ui";
import { SOCIAL_SPECS, type SocialSpec } from "@/lib/export/social";
import { downloadBlob, formatBytes, slugify } from "@/lib/utils";

export interface SocialPreview {
  url: string;
  blob: Blob;
}

export function SocialKitPanel({ brandSlug, previews, building }: { brandSlug: string; previews: Record<string, SocialPreview>; building: boolean }) {
  const download = (spec: SocialSpec) => {
    const p = previews[spec.id];
    if (!p) return;
    downloadBlob(p.blob, `${slugify(brandSlug)}-${spec.file}`);
  };
  const avatars = SOCIAL_SPECS.filter((s) => s.kind === "avatar");
  const covers = SOCIAL_SPECS.filter((s) => s.kind === "cover");
  return (
    <Card>
      <SectionHeader title="Social kit" description="Profile avatars and cover images rendered with the brand fonts, palette and logo. Each one is also in the kit under social/." actions={building ? <span className="text-xs text-fg-muted inline-flex items-center gap-2"><Spinner /> Rendering…</span> : null} />
      <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3 mb-4">
        {avatars.map((spec) => (
          <Tile key={spec.id} spec={spec} preview={previews[spec.id]} onDownload={() => download(spec)} />
        ))}
      </div>
      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3">
        {covers.map((spec) => (
          <Tile key={spec.id} spec={spec} preview={previews[spec.id]} onDownload={() => download(spec)} />
        ))}
      </div>
    </Card>
  );
}

function Tile({ spec, preview, onDownload }: { spec: SocialSpec; preview?: SocialPreview; onDownload: () => void }) {
  const ratio = spec.width / spec.height;
  return (
    <div className="surface-2 p-2 flex flex-col gap-2 min-w-0">
      <div className="inset checker overflow-hidden flex items-center justify-center" style={{ aspectRatio: `${spec.width} / ${spec.height}`, maxHeight: ratio > 3 ? 120 : undefined }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt={`${spec.label} preview`} className="w-full h-full object-contain" width={spec.width} height={spec.height} />
        ) : (
          <div className="w-full h-full shimmer" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">{spec.label}</div>
          <div className="text-[11px] text-fg-subtle font-mono truncate">
            {spec.platform}
            {preview ? ` · ${formatBytes(preview.blob.size)}` : ""}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onDownload} disabled={!preview} title={`Download ${spec.file}`} aria-label={`Download ${spec.label}`}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

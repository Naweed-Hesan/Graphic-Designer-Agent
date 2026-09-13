"use client";
import * as React from "react";
import { Clapperboard, Download, FileArchive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, SectionHeader } from "@/components/ui";
import { assetUrl, useProject } from "@/lib/store/project";
import type { Asset } from "@/lib/db";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { extForMime } from "./shared";

function fileName(a: Asset): string {
  const ext = extForMime(a.mime);
  return a.name.toLowerCase().endsWith(`.${ext}`) ? a.name : `${a.name}.${ext}`;
}

function Media({ a }: { a: Asset }) {
  const url = assetUrl(a);
  const ratio = a.width && a.height ? `${a.width} / ${a.height}` : "16 / 9";
  if (a.mime.startsWith("video/")) return <video src={url} controls loop muted playsInline preload="metadata" className="w-full bg-bg-inset checker" style={{ aspectRatio: ratio, maxHeight: 320 }} />;
  if (a.mime.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={a.name} className="w-full object-contain checker" style={{ aspectRatio: ratio, maxHeight: 320 }} />;
  }
  return (
    <div className="w-full flex items-center justify-center gap-2 text-fg-muted text-sm bg-bg-inset" style={{ aspectRatio: "16 / 9", maxHeight: 200 }}>
      <FileArchive className="h-5 w-5" /> {a.tags.includes("png-sequence") ? "PNG sequence (zip)" : a.mime}
    </div>
  );
}

function GalleryItem({ a }: { a: Asset }) {
  const removeAsset = useProject((s) => s.removeAsset);
  const [confirm, setConfirm] = React.useState(false);
  const kind = a.tags.includes("ai-video") ? "AI video" : a.tags.includes("png-sequence") ? "PNG sequence" : "Logo animation";
  const meta = [a.width && a.height ? `${a.width}×${a.height}` : null, a.duration ? `${a.duration.toFixed(1)}s` : null, formatBytes(a.blob.size), a.provider ?? null].filter(Boolean).join(" · ");
  return (
    <div className="surface-2 overflow-hidden flex flex-col">
      <Media a={a} />
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" title={a.name}>
              {a.name}
            </div>
            <div className="text-[11px] text-fg-subtle truncate">{meta}</div>
          </div>
          <Badge tone={kind === "AI video" ? "info" : "neutral"}>{kind}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => downloadBlob(a.blob, fileName(a))} title="Download">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          {confirm ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await removeAsset(a.id);
                  toast.message("Asset deleted");
                }}
              >
                Delete for good
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} title="Delete" className="ml-auto" aria-label={`Delete ${a.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every motion-stage asset (rendered logo animations, AI videos, PNG sequences). */
export function MotionGallery() {
  const assets = useProject((s) => s.assets);
  const items = assets.filter((a) => a.stage === "motion");
  return (
    <section data-testid="motion-gallery">
      <SectionHeader title="Motion assets" description={items.length ? `${items.length} in this project — saved locally with the project bundle.` : "Exports and generated videos are saved here with the project."} />
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <GalleryItem key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Clapperboard className="h-7 w-7" />} title="No motion assets yet" description="Export a logo animation or generate an AI video and it will appear here." className="p-8" />
      )}
    </section>
  );
}

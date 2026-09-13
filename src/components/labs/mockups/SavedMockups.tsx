"use client";
import * as React from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button, SectionHeader } from "@/components/ui";
import { assetUrl, useProject } from "@/lib/store/project";
import { downloadBlob, formatBytes, slugify } from "@/lib/utils";

export function SavedMockups() {
  const assets = useProject((s) => s.assets);
  const removeAsset = useProject((s) => s.removeAsset);
  const saved = assets.filter((a) => a.stage === "mockups" && a.kind === "image");
  if (saved.length === 0) return null;
  return (
    <section className="mt-8">
      <SectionHeader title="Saved mockups" description={`${saved.length} image${saved.length === 1 ? "" : "s"} in this project's assets, available to the Guidelines and Export stages.`} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {saved.map((a) => (
          <figure key={a.id} className="surface overflow-hidden group">
            <div className="bg-bg-inset aspect-[4/3] p-2">
              {/* Object URLs from IndexedDB blobs; next/image cannot optimise them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(a)} alt={a.name} className="block w-full h-full object-contain" />
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate" title={a.name}>
                  {a.name}
                </div>
                <div className="text-[11px] text-fg-subtle">
                  {a.width && a.height ? `${a.width}×${a.height} · ` : ""}
                  {formatBytes(a.blob.size)}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button variant="ghost" size="icon-sm" title="Download PNG" aria-label={`Download ${a.name}`} onClick={() => downloadBlob(a.blob, `${slugify(a.name)}.png`)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Delete"
                  aria-label={`Delete ${a.name}`}
                  onClick={() => removeAsset(a.id).then(() => toast.success("Mockup deleted")).catch(() => toast.error("Could not delete asset"))}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

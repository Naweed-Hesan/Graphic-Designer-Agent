"use client";
import * as React from "react";
import { Check, Download, Images, LayoutGrid, Search, Square, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, Input, Switch } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import type { Asset } from "@/lib/db";
import { fileToImageAsset } from "@/lib/imagery/image-utils";
import { PURPOSE_BY_ID, PURPOSE_IDS } from "@/lib/imagery/presets";
import type { ImagePurpose } from "@/lib/imagery/prompt-compiler";
import { cn, downloadBlob } from "@/lib/utils";
import { AssetImage, markImageryInProgress, originOf, purposeLabel, setStyleReferences, useImageryImages, useReferenceIds } from "./shared";
import { Lightbox } from "./Lightbox";

const IMAGE_FILE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

function tagLabel(tag: string): string {
  if (PURPOSE_IDS.has(tag)) return PURPOSE_BY_ID[tag as ImagePurpose].label;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 h-7 text-[12px] transition-colors cursor-pointer",
        active ? "border-accent/60 bg-accent-soft text-fg" : "border-line text-fg-muted hover:text-fg hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function UploadZone({ onFiles, busy, compact }: { onFiles: (files: File[]) => void; busy: boolean; compact?: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={cn(
        "inset grid-dots flex items-center gap-3 transition-colors",
        over && "border-accent bg-accent-soft/40",
        compact ? "px-4 py-2.5" : "px-6 py-10 flex-col text-center",
      )}
      data-testid="upload-zone"
    >
      <Upload className={cn("shrink-0 text-fg-subtle", compact ? "h-4 w-4" : "h-7 w-7")} />
      <div className={cn("min-w-0", compact ? "flex-1 text-left" : "")}>
        <div className={cn("font-medium", compact ? "text-[13px]" : "text-sm")}>{compact ? "Drop images here to add them to the gallery" : "Drop images here"}</div>
        <div className="text-xs text-fg-muted">PNG, JPEG, WebP, GIF or SVG · dimensions are read on import</div>
      </div>
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={busy} className="shrink-0">
        Browse files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg"
        multiple
        className="sr-only"
        aria-label="Upload images"
        data-testid="upload-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

function GalleryTile({ asset, isRef, selected, onOpen, onToggleSelect }: { asset: Asset; isRef: boolean; selected: boolean; onOpen: () => void; onToggleSelect: () => void }) {
  const meta = [purposeLabel(asset) ?? (originOf(asset) ? tagLabel(originOf(asset)!) : null), asset.provider, asset.width && asset.height ? `${asset.width}×${asset.height}` : null].filter(Boolean).join(" · ");
  return (
    <div className={cn("group relative mb-3 break-inside-avoid rounded-md overflow-hidden border bg-bg-inset", selected ? "border-accent ring-2 ring-accent/40" : "border-line")} data-testid="gallery-tile">
      <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in" title={asset.name}>
        <AssetImage asset={asset} className="block w-full h-auto" />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-7 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[11px] truncate">{asset.name}</div>
        <div className="text-[10px] opacity-80 truncate">{meta}</div>
      </div>
      <button
        type="button"
        onClick={onToggleSelect}
        aria-pressed={selected}
        aria-label={selected ? "Deselect" : "Select"}
        title={selected ? "Deselect" : "Select"}
        className={cn(
          "absolute top-1.5 left-1.5 h-6 w-6 rounded-md border flex items-center justify-center cursor-pointer transition-opacity",
          selected ? "bg-accent text-accent-fg border-accent opacity-100" : "bg-bg-elev/90 border-line text-fg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      {isRef && (
        <span className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-bg-elev/90 border border-line flex items-center justify-center text-accent" title="Style reference">
          <Star className="h-3.5 w-3.5 fill-current" />
        </span>
      )}
    </div>
  );
}

export function GalleryTab({ onUseInMoodboard }: { onUseInMoodboard: (ids: string[]) => void }) {
  const [includeLogo, setIncludeLogo] = React.useState(false);
  const images = useImageryImages(includeLogo);
  const refs = useReferenceIds();
  const addAsset = useProject((s) => s.addAsset);
  const removeAsset = useProject((s) => s.removeAsset);
  const [query, setQuery] = React.useState("");
  const [tag, setTag] = React.useState<string | null>(null);
  const [providerFilter, setProviderFilter] = React.useState<string | null>(null);
  const [onlyRefs, setOnlyRefs] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [lightboxId, setLightboxId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const allTags = Array.from(new Set(images.flatMap((a) => a.tags))).filter((t) => t !== "ai");
  const tags = [...allTags.filter((t) => PURPOSE_IDS.has(t)), ...allTags.filter((t) => !PURPOSE_IDS.has(t))];
  const providers = Array.from(new Set(images.map((a) => a.provider).filter((p): p is string => Boolean(p))));
  const q = query.trim().toLowerCase();
  const visible = images.filter(
    (a) =>
      (!tag || a.tags.includes(tag)) &&
      (!providerFilter || a.provider === providerFilter) &&
      (!onlyRefs || refs.includes(a.id)) &&
      (!q || `${a.name} ${a.prompt ?? ""} ${a.model ?? ""}`.toLowerCase().includes(q)),
  );
  const visibleIds = visible.map((a) => a.id);
  const imageIds = new Set(images.map((a) => a.id));
  const selectedIds = selected.filter((id) => imageIds.has(id));
  const selectedAssets = selectedIds.map((id) => images.find((a) => a.id === id)).filter((a): a is Asset => Boolean(a));
  const filtered = Boolean(tag || providerFilter || onlyRefs || q);

  const importFiles = async (files: File[]) => {
    const list = files.filter((f) => f.type.startsWith("image/") || IMAGE_FILE.test(f.name));
    if (!list.length) {
      toast.error("Drop image files (PNG, JPEG, WebP, GIF or SVG)");
      return;
    }
    setUploading(true);
    let ok = 0;
    const errors: string[] = [];
    for (const f of list) {
      try {
        const info = await fileToImageAsset(f);
        await addAsset({ kind: info.kind, name: info.name, mime: info.mime, blob: info.blob, svg: info.svg, width: info.width, height: info.height, stage: "imagery", tags: ["upload"] });
        ok++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    setUploading(false);
    if (ok) {
      markImageryInProgress();
      toast.success(ok === 1 ? "Image added to the gallery" : `${ok} images added to the gallery`);
    }
    if (errors.length) toast.error(`${errors.length} file${errors.length > 1 ? "s" : ""} skipped`, { description: errors.slice(0, 3).join("\n") });
  };

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`Delete ${selectedIds.length} image${selectedIds.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const pinned = selectedIds.filter((id) => refs.includes(id));
    if (pinned.length) setStyleReferences(pinned, false);
    for (const id of selectedIds) await removeAsset(id);
    setSelected([]);
    toast.success(`Deleted ${selectedIds.length} image${selectedIds.length > 1 ? "s" : ""}`);
  };
  const bulkRefs = () => {
    const allPinned = selectedIds.every((id) => refs.includes(id));
    setStyleReferences(selectedIds, !allPinned);
  };
  const bulkDownload = () => {
    selectedAssets.forEach((a, i) => setTimeout(() => downloadBlob(a.blob, a.name), i * 150));
  };
  const clearFilters = () => {
    setTag(null);
    setProviderFilter(null);
    setOnlyRefs(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && <UploadZone onFiles={importFiles} busy={uploading} compact />}

      {images.length > 0 && (
        <Card className="p-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-subtle pointer-events-none" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompts and names…" className="pl-8 h-8 text-[13px]" aria-label="Search images" />
            </div>
            <Switch checked={onlyRefs} onChange={setOnlyRefs} label="References only" />
            <Switch checked={includeLogo} onChange={setIncludeLogo} label="Include logo concepts" />
            <div className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
              <span>
                {visible.length} of {images.length}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(allVisibleSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...visibleIds])))} disabled={!visible.length}>
                {allVisibleSelected ? "Deselect all" : "Select all"}
              </Button>
            </div>
          </div>
          {(tags.length > 0 || providers.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip active={!tag} onClick={() => setTag(null)}>
                All
              </FilterChip>
              {tags.map((t) => (
                <FilterChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  {tagLabel(t)}
                </FilterChip>
              ))}
              {providers.length > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}
              {providers.map((p) => (
                <FilterChip key={p} active={providerFilter === p} onClick={() => setProviderFilter(providerFilter === p ? null : p)}>
                  <span className="font-mono">{p}</span>
                </FilterChip>
              ))}
              {filtered && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {selectedIds.length > 0 && (
        <div className="surface-2 px-3 py-2 flex flex-wrap items-center gap-2 animate-in" role="toolbar" aria-label="Selection actions">
          <span className="text-[13px] font-medium mr-1">
            {selectedIds.length} selected
          </span>
          <Button variant="secondary" size="sm" onClick={bulkRefs}>
            <Star className="h-3.5 w-3.5" /> {selectedIds.every((id) => refs.includes(id)) ? "Unpin references" : "Set as references"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onUseInMoodboard(selectedIds)}>
            <LayoutGrid className="h-3.5 w-3.5" /> Use in moodboard
          </Button>
          <Button variant="secondary" size="sm" onClick={bulkDownload}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="secondary" size="sm" onClick={bulkDelete} className="text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])} className="ml-auto">
            Clear selection
          </Button>
        </div>
      )}

      {images.length === 0 ? (
        <div className="flex flex-col gap-4">
          <EmptyState
            icon={<Images className="h-8 w-8" />}
            title="The gallery is empty"
            description="Generate images from the brand style, or upload photography and references to build the visual language."
          />
          <UploadZone onFiles={importFiles} busy={uploading} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<Search className="h-7 w-7" />} title="Nothing matches" description="Try another search or clear the filters." action={<Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>} />
      ) : (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3" data-testid="gallery-grid">
          {visible.map((a) => (
            <GalleryTile key={a.id} asset={a} isRef={refs.includes(a.id)} selected={selectedIds.includes(a.id)} onOpen={() => setLightboxId(a.id)} onToggleSelect={() => toggleSelect(a.id)} />
          ))}
        </div>
      )}

      <Lightbox assetId={lightboxId} ids={visibleIds} onClose={() => setLightboxId(null)} onSelect={setLightboxId} />
    </div>
  );
}

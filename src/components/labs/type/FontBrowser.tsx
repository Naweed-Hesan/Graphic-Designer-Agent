"use client";
import * as React from "react";
import { Check, Search } from "lucide-react";
import { Badge, Button, Dialog, Input, Spinner, Switch, Tabs } from "@/components/ui";
import type { FontMeta } from "@/app/api/fonts/route";
import type { Typography } from "@/lib/genome/schema";
import { hasArabic, searchFonts } from "@/lib/type/fontmeta";
import { cn } from "@/lib/utils";
import { CategoryBadge, FontText, SLOT_LABEL, type Slot } from "./shared";

const PAGE = 40;
const CATEGORIES = ["serif", "sans-serif", "display", "handwriting", "monospace"] as const;

export function FontBrowser({
  open,
  onClose,
  fonts,
  loading,
  source,
  slot,
  onSlotChange,
  typography,
  onAssign,
}: {
  open: boolean;
  onClose: () => void;
  fonts: FontMeta[];
  loading: boolean;
  source: string;
  slot: Slot;
  onSlotChange: (s: Slot) => void;
  typography: Typography;
  onAssign: (slot: Slot, meta: FontMeta) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [cats, setCats] = React.useState<string[]>([]);
  const [variableOnly, setVariableOnly] = React.useState(false);
  const [arabicOnly, setArabicOnly] = React.useState(false);
  const [preview, setPreview] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    let list = fonts;
    if (cats.length) list = list.filter((f) => cats.includes(f.category));
    if (variableOnly) list = list.filter((f) => f.variable);
    if (arabicOnly) list = list.filter(hasArabic);
    return searchFonts(list, query);
  }, [fonts, cats, variableOnly, arabicOnly, query]);
  const visible = filtered.slice(0, page * PAGE);
  const current = typography[slot].family;

  const toggleCat = (c: string) => {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
    setPage(1);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Font browser" description="Google Fonts catalogue. Pick a slot, then click a family to assign it." wide className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={slot} onChange={onSlotChange} items={(["display", "body", "mono"] as Slot[]).map((s) => ({ value: s, label: `${SLOT_LABEL[s]} · ${typography[s].family}` }))} />
          <span className="text-xs text-fg-subtle ml-auto">
            {loading ? "Loading catalogue…" : `${fonts.length} families · ${source === "bundled" ? "bundled list (catalogue offline)" : source || "catalogue"}`}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-fg-subtle pointer-events-none" />
            <Input
              aria-label="Search fonts"
              placeholder="Search families…"
              value={query}
              autoFocus
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <Input aria-label="Preview text" placeholder="Preview text (defaults to the family name)" value={preview} onChange={(e) => setPreview(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cats.includes(c)}
              onClick={() => toggleCat(c)}
              className={cn(
                "rounded-full border px-2.5 h-7 text-[12px] font-medium transition-colors cursor-pointer",
                cats.includes(c) ? "bg-accent-soft border-accent text-fg" : "border-line text-fg-muted hover:text-fg hover:border-line-strong",
              )}
            >
              {c}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-4">
            <Switch
              checked={variableOnly}
              onChange={(v) => {
                setVariableOnly(v);
                setPage(1);
              }}
              label="Variable only"
            />
            <Switch
              checked={arabicOnly}
              onChange={(v) => {
                setArabicOnly(v);
                setPage(1);
              }}
              label="Arabic"
            />
          </div>
        </div>

        <div className="inset max-h-[52vh] overflow-y-auto divide-y divide-line" role="listbox" aria-label="Font families">
          {loading ? (
            <div className="flex items-center justify-center gap-2 h-40 text-fg-muted text-sm">
              <Spinner /> Loading fonts…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-fg-muted text-sm">No families match.</div>
          ) : (
            visible.map((f) => <FontRow key={f.id} font={f} preview={preview} selected={f.family === current} onPick={() => onAssign(slot, f)} />)
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-fg-subtle">
          <span>
            Showing {Math.min(visible.length, filtered.length)} of {filtered.length}
          </span>
          {visible.length < filtered.length && (
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)}>
              Load more ({filtered.length - visible.length} remaining)
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

const FontRow = React.memo(function FontRow({ font, preview, selected, onPick }: { font: FontMeta; preview: string; selected: boolean; onPick: () => void }) {
  const weightCount = font.weights?.length ?? 0;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn("w-full flex items-center gap-4 px-4 py-2.5 text-left transition-colors cursor-pointer hover:bg-bg-elev-2", selected && "bg-accent-soft/50")}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-fg-subtle mb-0.5 flex items-center gap-1.5">
          {selected && <Check className="h-3 w-3 text-accent" />}
          {font.family}
        </div>
        <FontText family={font.family} fallback={font.category === "serif" ? "serif" : font.category === "monospace" ? "monospace" : "sans-serif"} className="truncate text-[22px] leading-tight" style={{ fontWeight: 400 }}>
          {preview.trim() || font.family}
        </FontText>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <CategoryBadge category={font.category} />
        {font.variable && <Badge tone="info">variable</Badge>}
        {hasArabic(font) && <Badge tone="success">Arabic</Badge>}
        <span className="text-[11px] text-fg-subtle w-16 text-right">{weightCount ? `${weightCount} weight${weightCount === 1 ? "" : "s"}` : ""}</span>
      </div>
    </button>
  );
});

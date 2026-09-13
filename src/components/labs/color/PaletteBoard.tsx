"use client";
import * as React from "react";
import { Eye, Plus } from "lucide-react";
import { Badge, Button, Card, SectionHeader, Tabs } from "@/components/ui";
import type { BrandColor } from "@/lib/genome/schema";
import { DEFICIENCIES, simulate, type DeficiencyType } from "@/lib/color/blindness";
import { toOklch, fromOklch } from "@/lib/color/convert";
import { nearestColorName } from "@/lib/color/names";
import { uid } from "@/lib/utils";
import { SwatchCard } from "./SwatchCard";
import { editPalette } from "./shared";

type SimValue = DeficiencyType | "none";

export function PaletteBoard({ colors, sim, onSimChange }: { colors: BrandColor[]; sim: DeficiencyType | null; onSimChange: (v: DeficiencyType | null) => void }) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const closeEditor = React.useCallback(() => setEditingId(null), []);

  const background = colors.find((c) => c.role === "background");
  const active = sim ? DEFICIENCIES.find((d) => d.id === sim) : null;

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= colors.length) return;
    editPalette((p) => {
      const [c] = p.colors.splice(from, 1);
      p.colors.splice(to, 0, c);
    }, "Reordered palette");
  };

  const addColor = () => {
    const anchor = colors.find((c) => c.role === "primary") ?? colors[0];
    let hex = "#6b7280";
    if (anchor) {
      const o = toOklch(anchor.hex);
      hex = fromOklch({ l: 0.6, c: Math.min(o.c, 0.1), h: o.h + 60 });
    }
    const id = uid(6);
    const name = nearestColorName(hex);
    editPalette((p) => {
      p.colors.push({ id, name, hex, role: "custom", usage: "", locked: false });
    }, `Added colour ${name}`);
    setEditingId(id);
  };

  return (
    <Card>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            Palette <Badge>{colors.length}</Badge>
          </span>
        }
        description="Click a swatch to edit. Drag to reorder. Locked colours survive regeneration."
        actions={
          <>
            <Tabs<SimValue>
              value={sim ?? "none"}
              onChange={(v) => onSimChange(v === "none" ? null : v)}
              items={[{ value: "none", label: "Normal", icon: <Eye className="h-3.5 w-3.5" /> }, ...DEFICIENCIES.map((d) => ({ value: d.id as SimValue, label: d.short }))]}
            />
            <Button variant="secondary" size="sm" onClick={addColor}>
              <Plus className="h-4 w-4" /> Add colour
            </Button>
          </>
        }
      />
      {active ? (
        <p className="text-xs text-fg-muted -mt-2 mb-3">
          Simulating <span className="text-fg font-medium">{active.label}</span> — {active.note}. Hex values shown are the originals.
        </p>
      ) : null}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
        {colors.map((c, i) => (
          <SwatchCard
            key={c.id}
            color={c}
            displayHex={sim ? simulate(c.hex, sim) : c.hex}
            backgroundHex={background && background.id !== c.id ? background.hex : undefined}
            index={i}
            count={colors.length}
            open={editingId === c.id}
            onOpen={() => setEditingId(c.id)}
            onClose={closeEditor}
            onMove={move}
            dragging={dragIndex === i}
            over={overIndex === i && dragIndex !== null && dragIndex !== i}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              e.preventDefault();
              if (overIndex !== i) setOverIndex(i);
            }}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
          />
        ))}
      </div>
    </Card>
  );
}

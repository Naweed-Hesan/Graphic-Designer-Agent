"use client";
import * as React from "react";
import { HexColorPicker } from "react-colorful";
import { ArrowLeft, ArrowRight, Lock, LockOpen, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Select, Switch } from "@/components/ui";
import type { BrandColor, ColorRole } from "@/lib/genome/schema";
import { bestTextOn, wcagRatio } from "@/lib/color/contrast";
import { hslCss, oklchCss, rgbCss } from "@/lib/color/convert";
import { nearestColorName } from "@/lib/color/names";
import { hexToCmyk } from "@/lib/export/tokens";
import { cn } from "@/lib/utils";
import { CopyButton, HexField, ROLES, ROLE_LABEL, ROLE_TONE, editPalette, useDismiss } from "./shared";

export interface SwatchCardProps {
  color: BrandColor;
  /** The hex actually painted (differs from color.hex under colour-blindness simulation). */
  displayHex: string;
  /** Palette background, for the "on background" contrast chip. */
  backgroundHex?: string;
  index: number;
  count: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onMove: (from: number, to: number) => void;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function SwatchCard(props: SwatchCardProps) {
  const { color, displayHex, backgroundHex, index, count, open, onOpen, onClose, onMove, dragging, over } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const [align, setAlign] = React.useState<"left" | "right">("left");
  useDismiss(ref, open, onClose);

  const textColor = bestTextOn(displayHex);
  const ratio = backgroundHex && color.role !== "background" ? wcagRatio(color.hex, backgroundHex) : null;

  const toggleLock = () =>
    editPalette(
      (p) => {
        const c = p.colors.find((x) => x.id === color.id);
        if (c) c.locked = !c.locked;
      },
      color.locked ? `Unlocked ${color.name}` : `Locked ${color.name}`,
    );

  return (
    <div
      ref={ref}
      className={cn("relative transition-opacity", dragging && "opacity-40", over && "ring-2 ring-accent rounded-lg")}
      draggable={!open}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
    >
      <button
        type="button"
        onClick={() => {
          const rect = ref.current?.getBoundingClientRect();
          setAlign(rect && rect.left + 320 > window.innerWidth - 24 ? "right" : "left");
          if (open) onClose();
          else onOpen();
        }}
        className={cn("w-full text-left rounded-lg border border-black/10 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-transform", open && "ring-2 ring-accent")}
        style={{ background: displayHex, color: textColor }}
        aria-label={`Edit ${color.name}`}
        aria-expanded={open}
      >
        <div className="h-28 p-3 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium leading-tight truncate">{color.name || "Untitled"}</span>
            {color.locked ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
          </div>
          <div className="flex items-end justify-between gap-2">
            <span className="font-mono text-[12px] opacity-90 uppercase">{color.hex}</span>
            {ratio !== null ? (
              <span className="font-mono text-[10px] opacity-80" title="WCAG contrast on the palette background">
                {ratio.toFixed(1)}:1
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <Badge tone={ROLE_TONE[color.role]}>{ROLE_LABEL[color.role]}</Badge>
        <button
          type="button"
          onClick={toggleLock}
          className={cn("rounded-md p-1 cursor-pointer transition-colors", color.locked ? "text-accent" : "text-fg-subtle hover:text-fg")}
          title={color.locked ? "Unlock (generators may replace it)" : "Lock (generators keep it)"}
          aria-label={color.locked ? `Unlock ${color.name}` : `Lock ${color.name}`}
          aria-pressed={color.locked}
        >
          {color.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
      {color.usage ? (
        <p className="text-[12px] text-fg-muted truncate mt-0.5 px-0.5" title={color.usage}>
          {color.usage}
        </p>
      ) : null}
      {open ? <SwatchEditor color={color} index={index} count={count} align={align} onMove={onMove} onClose={onClose} /> : null}
    </div>
  );
}

function SwatchEditor({ color, index, count, align, onMove, onClose }: { color: BrandColor; index: number; count: number; align: "left" | "right"; onMove: (from: number, to: number) => void; onClose: () => void }) {
  const patch = (fn: (c: BrandColor) => void, summary: string, debounced = false) =>
    editPalette(
      (p) => {
        const c = p.colors.find((x) => x.id === color.id);
        if (c) fn(c);
      },
      summary,
      debounced,
    );
  const setHex = (hex: string) => patch((c) => void (c.hex = hex), `Changed ${color.name} to ${hex.toUpperCase()}`, true);
  const cmyk = hexToCmyk(color.hex);
  const info: [string, string][] = [
    ["RGB", rgbCss(color.hex)],
    ["HSL", hslCss(color.hex)],
    ["OKLCH", oklchCss(color.hex)],
    ["CMYK", `${cmyk.c} ${cmyk.m} ${cmyk.y} ${cmyk.k}`],
  ];
  return (
    <div className={cn("absolute top-full z-30 mt-1 w-[300px] surface p-3 shadow-card animate-in flex flex-col gap-3", align === "right" ? "right-0" : "left-0")} role="dialog" aria-label={`Edit ${color.name}`}>
      <HexColorPicker color={color.hex} onChange={(v) => setHex(v.toLowerCase())} style={{ width: "100%", height: 150 }} />
      <div className="flex items-center gap-2">
        <HexField value={color.hex} onChange={setHex} ariaLabel={`${color.name} hex`} />
        <CopyButton text={color.hex.toUpperCase()} />
      </div>
      <Field label="Name">
        <div className="flex gap-2">
          <Input value={color.name} onChange={(e) => patch((c) => void (c.name = e.target.value), `Renamed ${color.name || "colour"} to ${e.target.value}`, true)} className="h-8" aria-label="Colour name" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const n = nearestColorName(color.hex);
              patch((c) => void (c.name = n), `Auto-named ${color.name || "colour"} as ${n}`);
            }}
            title="Name from the nearest known colour"
          >
            <Sparkles className="h-3.5 w-3.5" /> Auto
          </Button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Role">
          <Select value={color.role} onChange={(e) => patch((c) => void (c.role = e.target.value as ColorRole), `Set ${color.name} role to ${e.target.value}`)} className="h-8" aria-label="Role">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Usage">
          <Input value={color.usage} onChange={(e) => patch((c) => void (c.usage = e.target.value), `Updated usage for ${color.name}`, true)} placeholder="Where it's used" className="h-8" aria-label="Usage" />
        </Field>
      </div>
      <dl className="inset px-2.5 py-2 grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-2 text-[11px] font-mono">
        {info.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-fg-subtle">{k}</dt>
            <dd className="truncate text-fg-muted" title={v}>
              {v}
            </dd>
            <dd>
              <CopyButton text={v} className="h-6 w-6" />
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="flex items-center justify-between border-t border-line pt-3">
        <Switch checked={color.locked} onChange={() => patch((c) => void (c.locked = !c.locked), color.locked ? `Unlocked ${color.name}` : `Locked ${color.name}`)} label={color.locked ? "Locked" : "Unlocked"} />
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={() => onMove(index, index - 1)} disabled={index === 0} title="Move earlier" aria-label="Move earlier">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onMove(index, index + 1)} disabled={index >= count - 1} title="Move later" aria-label="Move later">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-danger hover:text-danger"
            onClick={() => {
              onClose();
              editPalette((p) => {
                p.colors = p.colors.filter((x) => x.id !== color.id);
                delete p.dark[color.id];
              }, `Removed ${color.name}`);
            }}
            title="Delete colour"
            aria-label={`Delete ${color.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";
import * as React from "react";
import { ArrowRight, Moon, Sun, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { BrandColor } from "@/lib/genome/schema";
import { bestTextOn } from "@/lib/color/contrast";
import { DARK_GROUND, darkPalette, suggestDarkVariant } from "@/lib/color/dark";
import { ColorWell, HexField, editPalette } from "./shared";

export function DarkModePanel({ colors, dark, brandName }: { colors: BrandColor[]; dark: Record<string, string>; brandName: string }) {
  const resolved = React.useMemo(() => new Map(darkPalette(colors, dark).map((d) => [d.id, d])), [colors, dark]);
  const byRole = (role: BrandColor["role"]) => colors.find((c) => c.role === role);
  const bg = byRole("background");
  const text = byRole("text");
  const primary = byRole("primary") ?? colors[0];
  const accent = byRole("accent") ?? byRole("secondary") ?? primary;
  const darkHex = (c: BrandColor | undefined, fallback: string) => (c ? (resolved.get(c.id)?.hex ?? fallback) : fallback);
  const missing = colors.filter((c) => !dark[c.id]);

  const setDark = (c: BrandColor, hex: string, debounced = true) =>
    editPalette((p) => {
      p.dark[c.id] = hex;
    }, `Set dark variant for ${c.name}`, debounced);
  const clearDark = (c: BrandColor) =>
    editPalette((p) => {
      delete p.dark[c.id];
    }, `Cleared dark variant for ${c.name}`);

  const themes = [
    { key: "light", label: "Light", icon: <Sun className="h-3 w-3" />, bg: bg?.hex ?? "#ffffff", fg: text?.hex ?? "#111111", hexFor: (c: BrandColor) => c.hex },
    { key: "dark", label: "Dark", icon: <Moon className="h-3 w-3" />, bg: darkHex(bg, DARK_GROUND), fg: darkHex(text, "#f2f2f2"), hexFor: (c: BrandColor) => resolved.get(c.id)?.hex ?? c.hex },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {themes.map((t) => (
          <div key={t.key} className="rounded-lg border border-line p-4 flex flex-col gap-3" style={{ background: t.bg, color: t.fg }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase opacity-60">
              {t.icon} {t.label}
            </div>
            <div className="font-display text-2xl leading-tight truncate">{brandName || "Brand name"}</div>
            <p className="text-[13px] leading-relaxed opacity-80">Body copy keeps its rhythm in both themes; only the palette flips.</p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md px-3 py-1.5 text-[13px] font-medium" style={{ background: t.hexFor(primary), color: bestTextOn(t.hexFor(primary)) }}>
                Primary action
              </span>
              <span className="rounded-md px-3 py-1.5 text-[13px] font-medium border" style={{ borderColor: t.hexFor(accent), color: t.hexFor(accent) }}>
                Accent
              </span>
            </div>
            <div className="flex gap-1 mt-auto">
              {colors.map((c) => (
                <span key={c.id} className="h-4 flex-1 rounded-sm border border-black/10" style={{ background: t.hexFor(c) }} title={`${c.name}: ${t.hexFor(c).toUpperCase()}`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-fg-muted">Overrides are stored per colour and exported inside a <code className="font-mono">prefers-color-scheme: dark</code> block. Unset colours are previewed with a suggestion.</p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!missing.length}
          onClick={() =>
            editPalette((p) => {
              for (const c of missing) p.dark[c.id] = resolved.get(c.id)?.hex ?? suggestDarkVariant(c);
            }, `Suggested dark variants for ${missing.length} colours`)
          }
          title="Fill every unset colour with the suggested dark variant"
        >
          <Wand2 className="h-3.5 w-3.5" /> Suggest all
        </Button>
      </div>

      <ul className="flex flex-col gap-1.5">
        {colors.map((c) => {
          const d = resolved.get(c.id)!;
          return (
            <li key={c.id} className="surface-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 px-2.5 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-8 w-8 rounded-md border border-black/10 shrink-0" style={{ background: c.hex }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] font-mono text-fg-muted uppercase">{c.hex}</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
              <div className="flex items-center gap-2 min-w-0">
                <ColorWell value={d.hex} onChange={(hex) => setDark(c, hex)} label={`${c.name} dark variant`} />
                <div className="min-w-0 flex-1">
                  <HexField value={d.hex} onChange={(hex) => setDark(c, hex)} ariaLabel={`${c.name} dark hex`} className={d.overridden ? "" : "text-fg-subtle"} />
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {d.overridden ? (
                  <Button variant="ghost" size="icon-sm" onClick={() => clearDark(c)} title="Clear override" aria-label={`Clear dark variant for ${c.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setDark(c, d.hex, false)} title="Save the suggested variant">
                    <Wand2 className="h-3.5 w-3.5" /> Use
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";
import * as React from "react";
import { Badge, Tabs } from "@/components/ui";
import type { BrandColor } from "@/lib/genome/schema";
import { contrastReport, type ContrastReport } from "@/lib/color/contrast";
import { cn } from "@/lib/utils";

type Mode = "wcag" | "apca";

function wcagTint(r: ContrastReport) {
  if (r.aaaNormal) return "bg-success/20 text-success";
  if (r.aaNormal) return "bg-success/10 text-success";
  if (r.aaLarge) return "bg-warning/15 text-warning";
  return "bg-danger/10 text-danger";
}
function wcagMark(r: ContrastReport) {
  return r.aaaNormal ? "AAA" : r.aaNormal ? "AA" : r.aaLarge ? "AA large" : "Fail";
}
function apcaTint(r: ContrastReport) {
  const a = Math.abs(r.apca);
  if (a >= 75) return "bg-success/20 text-success";
  if (a >= 60) return "bg-success/10 text-success";
  if (a >= 45) return "bg-warning/15 text-warning";
  if (a >= 30) return "bg-warning/10 text-warning";
  return "bg-danger/10 text-danger";
}
function apcaMark(r: ContrastReport) {
  const a = Math.abs(r.apca);
  return a >= 90 ? "Any text" : a >= 75 ? "Body" : a >= 60 ? "Large" : a >= 45 ? "Headline" : a >= 30 ? "Non-text" : "Fail";
}

export function ContrastMatrix({ colors }: { colors: BrandColor[] }) {
  const [mode, setMode] = React.useState<Mode>("wcag");
  const keyPairs = React.useMemo(() => {
    const byRole = (role: BrandColor["role"]) => colors.find((c) => c.role === role);
    const bg = byRole("background");
    const text = byRole("text");
    const primary = byRole("primary");
    const accent = byRole("accent");
    const pairs: { fg: BrandColor; bg: BrandColor; label: string }[] = [];
    if (text && bg) pairs.push({ fg: text, bg, label: "Text on background" });
    if (primary && bg) pairs.push({ fg: primary, bg, label: "Primary on background" });
    if (accent && primary) pairs.push({ fg: accent, bg: primary, label: "Accent on primary" });
    return pairs;
  }, [colors]);
  const keySet = new Set(keyPairs.map((p) => `${p.fg.id}:${p.bg.id}`));

  const reports = React.useMemo(() => {
    const m = new Map<string, ContrastReport>();
    for (const fg of colors) for (const bg of colors) if (fg.id !== bg.id) m.set(`${fg.id}:${bg.id}`, contrastReport(fg.hex, bg.hex));
    return m;
  }, [colors]);

  const tint = mode === "wcag" ? wcagTint : apcaTint;
  const mark = mode === "wcag" ? wcagMark : apcaMark;
  const value = (r: ContrastReport) => (mode === "wcag" ? `${r.ratio.toFixed(2)}:1` : `Lc ${r.apca.toFixed(0)}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {keyPairs.length ? (
            keyPairs.map((p) => {
              const r = reports.get(`${p.fg.id}:${p.bg.id}`)!;
              return (
                <div key={p.label} className={cn("inline-flex items-center gap-2 rounded-md border border-line pl-1 pr-2 py-1 text-[12px]", tint(r).split(" ")[0])} title={`${p.fg.name} on ${p.bg.name}`}>
                  <span className="h-6 w-8 rounded flex items-center justify-center text-[11px] font-semibold" style={{ background: p.bg.hex, color: p.fg.hex }}>
                    Aa
                  </span>
                  <span className="text-fg-muted">{p.label}</span>
                  <span className={cn("font-mono", tint(r).split(" ")[1])}>
                    {value(r)} · {mark(r)}
                  </span>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-fg-muted">Assign background, text, primary and accent roles to see the pairs that matter.</span>
          )}
        </div>
        <Tabs<Mode>
          value={mode}
          onChange={setMode}
          items={[
            { value: "wcag", label: "WCAG 2" },
            { value: "apca", label: "APCA" },
          ]}
        />
      </div>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="border-separate border-spacing-1 text-[11px]">
          <thead>
            <tr>
              <th className="text-left font-normal text-fg-subtle align-bottom pb-1 pr-2 whitespace-nowrap">
                text ↓ &nbsp; background →
              </th>
              {colors.map((bg) => (
                <th key={bg.id} className="font-normal align-bottom pb-1 min-w-[76px]">
                  <div className="h-5 rounded border border-black/10" style={{ background: bg.hex }} />
                  <div className="truncate max-w-[76px] mt-1 text-fg-muted" title={bg.name}>
                    {bg.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((fg) => (
              <tr key={fg.id}>
                <th className="text-left font-normal pr-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded border border-black/10 shrink-0" style={{ background: fg.hex }} />
                    <span className="truncate max-w-[110px] text-fg-muted" title={fg.name}>
                      {fg.name}
                    </span>
                  </div>
                </th>
                {colors.map((bg) => {
                  if (fg.id === bg.id) return <td key={bg.id} className="rounded-md bg-bg-inset/60" />;
                  const r = reports.get(`${fg.id}:${bg.id}`)!;
                  const isKey = keySet.has(`${fg.id}:${bg.id}`);
                  return (
                    <td key={bg.id} className={cn("rounded-md p-1.5 text-center align-middle", tint(r), isKey && "ring-2 ring-accent")} title={`${fg.name} on ${bg.name}: ${r.ratio}:1 · APCA Lc ${r.apca} — ${r.apcaUse}`}>
                      <div className="h-6 rounded flex items-center justify-center font-semibold text-[12px]" style={{ background: bg.hex, color: fg.hex }}>
                        Aa
                      </div>
                      <div className="mt-1 font-mono">{value(r)}</div>
                      <div className="text-[10px] opacity-80 whitespace-nowrap">{mark(r)}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
        {mode === "wcag" ? (
          <>
            <span><Badge tone="success">AAA</Badge> ≥ 7:1</span>
            <span><Badge tone="success">AA</Badge> ≥ 4.5:1 body text</span>
            <span><Badge tone="warning">AA large</Badge> ≥ 3:1 headlines &amp; UI</span>
            <span><Badge tone="danger">Fail</Badge> below 3:1</span>
          </>
        ) : (
          <>
            <span><Badge tone="success">Lc 75+</Badge> body text</span>
            <span><Badge tone="success">Lc 60+</Badge> large text</span>
            <span><Badge tone="warning">Lc 45+</Badge> bold headlines, UI</span>
            <span><Badge tone="danger">Lc &lt; 30</Badge> not for text</span>
          </>
        )}
        <span className="ml-auto">Ring = the pairs that matter most.</span>
      </div>
    </div>
  );
}

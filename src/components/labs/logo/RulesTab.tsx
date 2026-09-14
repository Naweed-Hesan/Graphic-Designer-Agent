"use client";
import * as React from "react";
import { NumberInput } from "@/components/ui/number-input";
import { Check, Plus, Ruler, X } from "lucide-react";
import { Badge, Card, Chips } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { getLogoVariants, paletteColor, placeholderMarkSvg, primaryLogo } from "@/lib/logo/assets";
import { clearspaceGuideSvg, monochrome } from "@/lib/logo/svg";
import { svgSize } from "@/lib/raster";
import { cn, debounce } from "@/lib/utils";
import { Control, Notice, SvgView } from "./shared";
import { Slider } from "@/components/ui";

export const STANDARD_DONTS = ["Don't stretch or distort the logo", "Don't rotate the logo", "Don't add effects (shadows, gradients, outlines)", "Don't recolour outside the palette", "Don't place on busy imagery", "Don't crowd the clearspace"];

const SUGGESTED_RULES = ["Prefer the primary lockup on light backgrounds", "Use the mark alone below the minimum lockup size", "Use the mono variant on photography and single-colour print", "Reverse to white on the primary colour"];

const TEST_SIZES = [16, 24, 32, 48, 64];

type RulesPatch = { clearspaceMultiplier?: number; minSizePx?: number; minSizeMm?: number };

function makeRulesCommit(update: ReturnType<typeof useProject.getState>["update"]) {
  let pending: RulesPatch = {};
  const flush = debounce(() => {
    const patch = pending;
    pending = {};
    if (!Object.keys(patch).length) return;
    update(
      (g) => {
        Object.assign(g.visual.logo, patch);
      },
      { summary: "Updated logo rules", stage: "logo" },
    );
  }, 300);
  return (patch: RulesPatch) => {
    pending = { ...pending, ...patch };
    flush();
  };
}

export function RulesTab() {
  const genome = useProject((s) => s.genome)!;
  const assets = useProject((s) => s.assets);
  const update = useProject((s) => s.update);
  const logo = genome.visual.logo;

  const artwork = React.useMemo(() => primaryLogo(genome, assets), [genome, assets]);
  const markSvg = React.useMemo(() => getLogoVariants(genome, assets).mark?.svg ?? placeholderMarkSvg(genome), [genome, assets]);
  const primaryHex = paletteColor(genome, "primary", "#1f1f1f");
  const lightBg = paletteColor(genome, "background", "#ffffff");

  const [clearspace, setClearspace] = React.useState(logo.clearspaceMultiplier);
  const [minPx, setMinPx] = React.useState(logo.minSizePx);
  const [minMm, setMinMm] = React.useState(logo.minSizeMm);

  // Accumulates rapid edits to several fields into one debounced Genome write.
  const [commit] = React.useState(() => makeRulesCommit(update));

  const guide = React.useMemo(() => clearspaceGuideSvg(artwork.svg, clearspace), [artwork.svg, clearspace]);
  const size = svgSize(artwork.svg);
  const aspect = size.width / size.height;

  const addRule = (field: "usageRules" | "doNots", value: string) => {
    if (logo[field].includes(value)) return;
    update((g) => void g.visual.logo[field].push(value), { summary: `Added logo ${field === "doNots" ? "don't" : "rule"}`, stage: "logo" });
  };
  const setRules = (field: "usageRules" | "doNots", value: string[]) => {
    update((g) => void (g.visual.logo[field] = value), { summary: `Edited logo ${field === "doNots" ? "don'ts" : "usage rules"}`, stage: "logo" });
  };

  return (
    <div className="flex flex-col gap-5">
      {artwork.source === "placeholder" ? <Notice tone="info">Rules preview a generated placeholder until a mark or lockup is saved — the guide, tests and board update automatically.</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
        <Card className="flex flex-col gap-4">
          <Control label="Clearspace" hint={`${clearspace}x`}>
            <Slider
              min={0.25}
              max={3}
              step={0.25}
              value={clearspace}
              onChange={(e) => {
                const v = Number(e.target.value);
                setClearspace(v);
                commit({ clearspaceMultiplier: v });
              }}
              aria-label="Clearspace multiplier"
            />
            <p className="text-[11px] text-fg-subtle">x = a quarter of the logo height. Keep {clearspace}x of empty space on every side.</p>
          </Control>
          <div className="h-px bg-line" />
          <div className="grid grid-cols-2 gap-3">
            <Control label="Min. size (screen)" hint="px wide">
              <NumberInput
                min={8}
                max={512}
                value={minPx}
                onCommit={(v) => {
                  setMinPx(v);
                  commit({ minSizePx: v });
                }}
                aria-label="Minimum size in pixels"
              />
            </Control>
            <Control label="Min. size (print)" hint="mm wide">
              <NumberInput
                min={1}
                max={200}
                step={0.5}
                value={minMm}
                onCommit={(v) => {
                  setMinMm(v);
                  commit({ minSizeMm: v });
                }}
                aria-label="Minimum size in millimetres"
              />
            </Control>
          </div>
          <p className="text-[11px] text-fg-subtle">Below the minimum, switch to the mark alone. {minMm}mm ≈ {Math.round((minMm / 25.4) * 300)}px at 300 dpi.</p>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          <div className="surface overflow-hidden">
            <div className="p-6 h-[320px]" style={{ background: lightBg }}>
              <SvgView svg={guide} className="h-full w-full" title="Clearspace guide" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-line text-[12px] text-fg-muted">
              <Ruler className="h-3.5 w-3.5" /> Clearspace guide · {clearspace}x on every side · based on the {artwork.label.toLowerCase()}
            </div>
          </div>

          <div className="surface overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
              <div className="text-sm font-semibold">Minimum size test</div>
              <span className="text-[11px] text-fg-subtle">mark at fixed pixel sizes · lockup at {minPx}px</span>
            </div>
            <div className="flex flex-wrap items-end gap-8 px-6 py-5" style={{ background: lightBg }}>
              {TEST_SIZES.map((px) => {
                const ok = px >= minPx;
                return (
                  <div key={px} className="flex flex-col items-center gap-2">
                    <SvgView svg={markSvg} style={{ width: px, height: px }} title={`Mark at ${px}px`} />
                    <span className={cn("text-[10px] font-mono inline-flex items-center gap-0.5", ok ? "text-success" : "text-danger")}>
                      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {px}px
                    </span>
                  </div>
                );
              })}
              <div className="flex flex-col items-center gap-2 ml-auto">
                <SvgView svg={artwork.svg} style={{ width: minPx, height: Math.max(8, Math.round(minPx / aspect)) }} title={`Lockup at ${minPx}px`} />
                <span className="text-[10px] font-mono text-fg-muted">lockup @ {minPx}px</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-semibold">Usage rules</div>
            <p className="text-[12px] text-fg-muted">Where and how the logo should appear. Printed in the guidelines and the kit README.</p>
          </div>
          <Chips value={logo.usageRules} onChange={(v) => setRules("usageRules", v)} placeholder="Add a rule and press Enter" />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_RULES.filter((r) => !logo.usageRules.includes(r)).map((r) => (
              <button key={r} type="button" onClick={() => addRule("usageRules", r)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 h-7 text-[12px] text-fg-muted hover:text-fg hover:border-line-strong cursor-pointer">
                <Plus className="h-3 w-3" /> {r}
              </button>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-semibold">Don&apos;ts</div>
            <p className="text-[12px] text-fg-muted">Standard misuse cases — add the six classics with one click.</p>
          </div>
          <Chips value={logo.doNots} onChange={(v) => setRules("doNots", v)} placeholder="Add a don't and press Enter" />
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_DONTS.filter((r) => !logo.doNots.includes(r)).map((r) => (
              <button key={r} type="button" onClick={() => addRule("doNots", r)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 h-7 text-[12px] text-fg-muted hover:text-fg hover:border-line-strong cursor-pointer">
                <Plus className="h-3 w-3" /> {r.replace(/^Don't /, "")}
              </button>
            ))}
            {STANDARD_DONTS.every((r) => logo.doNots.includes(r)) ? <span className="text-[12px] text-fg-subtle">All six standard don&apos;ts are in.</span> : null}
          </div>
        </Card>
      </div>

      <DoDontBoard svg={artwork.svg} background={lightBg} primary={primaryHex} />
    </div>
  );
}

function DoDontBoard({ svg, background, primary }: { svg: string; background: string; primary: string }) {
  const lowContrast = React.useMemo(() => monochrome(svg, shade(primary, 0.18)), [svg, primary]);
  const offPalette = React.useMemo(() => monochrome(svg, "#7c3aed"), [svg]);
  const cells: { label: string; ok: boolean; bg?: string; style?: React.CSSProperties; svg?: string; extra?: React.ReactNode; className?: string }[] = [
    { label: "Use the supplied artwork", ok: true },
    { label: "Don't stretch or distort", ok: false, style: { transform: "scaleX(1.45)" } },
    { label: "Don't rotate", ok: false, style: { transform: "rotate(-14deg)" } },
    { label: "Don't add effects", ok: false, style: { filter: "drop-shadow(4px 6px 4px rgba(0,0,0,0.55))" } },
    { label: "Don't recolour off-palette", ok: false, svg: offPalette },
    { label: "Don't use low contrast", ok: false, bg: primary, svg: lowContrast },
    { label: "Don't place on busy imagery", ok: false, bg: `repeating-linear-gradient(45deg, #c7d2fe 0 8px, #fca5a5 8px 16px, #fde68a 16px 24px)` },
    {
      label: "Don't crowd the clearspace",
      ok: false,
      className: "!p-2",
      extra: (
        <div className="absolute inset-0 flex flex-col justify-between p-1 pointer-events-none">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-fg" style={{ color: "#111" }}>
            Summer sale — 40% off everything
          </div>
          <div className="text-[9px] text-fg" style={{ color: "#111" }}>
            Terms apply · Ends Sunday · Members only
          </div>
        </div>
      ),
    },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Do / Don&apos;t board</h2>
          <p className="text-[12px] text-fg-muted">Rendered live from the current logo so the guidelines always show the real artwork.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="surface-2 overflow-hidden">
            <div className={cn("relative h-32 p-5 overflow-hidden", c.className)} style={{ background: c.bg ?? background }}>
              <div className="h-full w-full" style={c.style}>
                <SvgView svg={c.svg ?? svg} className="h-full w-full" title={c.label} />
              </div>
              {c.extra}
              {!c.ok ? (
                <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="0" y1="0" x2="100" y2="100" stroke="#e11d48" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeOpacity="0.7" />
                </svg>
              ) : null}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-line text-[12px]">
              <Badge tone={c.ok ? "success" : "danger"}>{c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</Badge>
              <span className="truncate">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lighten (amount > 0) or darken a hex colour by mixing with white/black. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

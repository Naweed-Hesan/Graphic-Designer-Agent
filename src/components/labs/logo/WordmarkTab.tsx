"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, Type } from "lucide-react";
import { Badge, Button, Card, Input, Select, Slider, Switch } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { paletteColor } from "@/lib/logo/assets";
import { buildWordmarkSvg, type LetterCase, type WordmarkResult } from "@/lib/logo/wordmark";
import { recolorSvg } from "@/lib/logo/svg";
import { bestTextOn } from "@/lib/color/contrast";
import { ensureFont } from "@/lib/type/fonts";
import { fetchFonts } from "@/lib/api";
import { Control, DownloadSvgButton, Notice, PaletteChips, PreviewCard, SvgView, WORDMARK_TAG, errorMessage } from "./shared";

type Slot = "display" | "body" | "mono" | "custom";
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function WordmarkTab({ onSaved }: { onSaved: () => void }) {
  const genome = useProject((s) => s.genome)!;
  const update = useProject((s) => s.update);
  const addAsset = useProject((s) => s.addAsset);
  const logo = genome.visual.logo;
  const typo = genome.visual.typography;

  const [text, setText] = React.useState(logo.wordmarkText || genome.name);
  const [slot, setSlot] = React.useState<Slot>(logo.wordmarkFont);
  const [customFamily, setCustomFamily] = React.useState("");
  const [weight, setWeight] = React.useState(logo.wordmarkWeight);
  const [tracking, setTracking] = React.useState(logo.wordmarkTracking);
  const [letterCase, setLetterCase] = React.useState<LetterCase>(logo.wordmarkCase);
  const [color, setColor] = React.useState(paletteColor(genome, "primary", "#1f1f1f"));
  const [outline, setOutline] = React.useState(false);
  const [result, setResult] = React.useState<WordmarkResult | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [families, setFamilies] = React.useState<string[] | null>(null);

  const family = slot === "custom" ? customFamily.trim() || typo.display.family : typo[slot].family;
  const fallback = slot === "custom" ? "sans-serif" : typo[slot].fallback;
  const slotWeights = slot === "custom" ? [] : typo[slot].weights;

  // Rebuild the preview (debounced). Outlining fetches the TTF; failures fall back to live text with a note.
  React.useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      ensureFont(family, [weight]);
      setBuilding(true);
      buildWordmarkSvg({ text, family, weight, tracking, letterCase, color, outline, fallback })
        .then((r) => {
          if (!cancelled) setResult(r);
        })
        .catch((e) => {
          if (!cancelled) toast.error(errorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setBuilding(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, family, weight, tracking, letterCase, color, outline, fallback]);

  const loadFamilies = async () => {
    if (families) return;
    try {
      const { fonts } = await fetchFonts();
      setFamilies(fonts.map((f) => f.family));
    } catch {
      setFamilies([]);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const saved = await addAsset({
        kind: "svg",
        name: `Wordmark — ${text}`,
        mime: "image/svg+xml",
        blob: new Blob([result.svg], { type: "image/svg+xml" }),
        svg: result.svg,
        width: result.width,
        height: result.height,
        stage: "logo",
        tags: [WORDMARK_TAG, result.outlined ? "outlined" : "live-text"],
      });
      update(
        (g) => {
          const l = g.visual.logo;
          l.wordmarkAssetId = saved.id;
          l.variants.wordmark = saved.id;
          l.wordmarkText = text;
          if (slot !== "custom") l.wordmarkFont = slot;
          l.wordmarkWeight = weight;
          l.wordmarkTracking = tracking;
          l.wordmarkCase = letterCase;
          if (!g.stages.logo || g.stages.logo === "todo") g.stages.logo = "in-progress";
        },
        { summary: `Set wordmark "${text}"`, stage: "logo" },
      );
      toast.success(result.outlined ? "Wordmark saved (outlined)" : "Wordmark saved as live text");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const reversed = React.useMemo(() => (result ? recolorSvg(result.svg, "#ffffff") : null), [result]);
  const primaryHex = paletteColor(genome, "primary", "#1f1f1f");
  const lightBg = paletteColor(genome, "background", "#ffffff");
  const darkBg = paletteColor(genome, "secondary", "#111111");

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr] items-start">
      <Card className="flex flex-col gap-4">
        <Control label="Text">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={genome.name} aria-label="Wordmark text" />
        </Control>
        <Control label="Font">
          <Select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} aria-label="Font slot">
            <option value="display">Display — {typo.display.family}</option>
            <option value="body">Body — {typo.body.family}</option>
            <option value="mono">Mono — {typo.mono.family}</option>
            <option value="custom">Any Google font…</option>
          </Select>
          {slot === "custom" ? (
            <>
              <Input list="wordmark-families" value={customFamily} onChange={(e) => setCustomFamily(e.target.value)} onFocus={loadFamilies} placeholder="e.g. Space Grotesk" aria-label="Font family" className="mt-1.5" />
              <datalist id="wordmark-families">{(families ?? []).slice(0, 400).map((f) => <option key={f} value={f} />)}</datalist>
            </>
          ) : null}
        </Control>
        <Control label="Weight" hint={slotWeights.length ? `in system: ${slotWeights.join(", ")}` : undefined}>
          <Select value={weight} onChange={(e) => setWeight(Number(e.target.value))} aria-label="Font weight">
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {w}
                {slotWeights.includes(w) ? " ✓" : ""}
              </option>
            ))}
          </Select>
        </Control>
        <Control label="Tracking" hint={`${tracking >= 0 ? "+" : ""}${Math.round(tracking * 1000)}‰`}>
          <Slider min={-0.1} max={0.4} step={0.005} value={tracking} onChange={(e) => setTracking(Number(e.target.value))} aria-label="Tracking" />
        </Control>
        <Control label="Case">
          <Select value={letterCase} onChange={(e) => setLetterCase(e.target.value as LetterCase)} aria-label="Letter case">
            <option value="none">As typed</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
          </Select>
        </Control>
        <Control label="Colour">
          <PaletteChips genome={genome} value={color} onChange={setColor} />
        </Control>
        <div className="h-px bg-line" />
        <Switch checked={outline} onChange={setOutline} label="Outline to paths" className="text-left" />
        <p className="text-[11px] text-fg-subtle -mt-2">Fetches the TTF and converts glyphs to vector paths so the SVG no longer depends on installed fonts. Needs internet.</p>
      </Card>

      <div className="flex flex-col gap-4 min-w-0">
        <div className="surface overflow-hidden">
          <div className="relative h-[240px] p-10" style={{ background: lightBg }}>
            {result ? <SvgView svg={result.svg} className="h-full w-full" title="Wordmark preview" /> : <div className="h-full flex items-center justify-center text-sm text-fg-muted">Building…</div>}
            <div className="absolute top-3 right-3 flex gap-1.5">
              {building ? <Badge tone="accent">Updating…</Badge> : null}
              {result ? <Badge tone={result.outlined ? "success" : "neutral"}>{result.outlined ? "Outlined paths" : "Live text"}</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-line text-[12px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" /> {family} {weight}
            </span>
            {result ? (
              <span>
                {Math.round(result.width)}×{Math.round(result.height)} units
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {result ? <DownloadSvgButton svg={result.svg} name={`${text}-wordmark`} /> : null}
              <Button size="sm" onClick={save} disabled={!result} loading={saving}>
                <Check className="h-4 w-4" /> Use as wordmark
              </Button>
            </div>
          </div>
        </div>

        {result?.note ? <Notice tone={result.outlined ? "success" : outline ? "warning" : "info"}>{result.note}</Notice> : null}

        {reversed ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PreviewCard svg={reversed} background={darkBg} label="Reversed on dark" height="h-32" />
            <PreviewCard svg={recolorSvg(result!.svg, bestTextOn(primaryHex))} background={primaryHex} label="On primary" height="h-32" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

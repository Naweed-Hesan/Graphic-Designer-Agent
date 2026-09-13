"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Switch, Tabs } from "@/components/ui";
import type { Genome, TypeStyle } from "@/lib/genome/schema";
import type { FontMeta } from "@/app/api/fonts/route";
import { defaultTextStyles } from "@/lib/type/scale";
import { ARABIC_SAMPLE, characterSets, specimenPalette, specimenTexts } from "@/lib/type/specimen";
import { fontStack } from "@/lib/type/fonts";
import { findFont, hasArabic } from "@/lib/type/fontmeta";
import { cn } from "@/lib/utils";
import { Section } from "./shared";

const deterministicId = (i: number) => `default-${i}`;

export function Specimen({ genome, fonts }: { genome: Genome; fonts: FontMeta[] }) {
  const [mode, setMode] = React.useState<"light" | "dark">("light");
  const [arabic, setArabic] = React.useState(false);
  const t = genome.visual.typography;
  const arabicAvailable = hasArabic(findFont(fonts, t.display.family)) || hasArabic(findFont(fonts, t.body.family));
  const texts = React.useMemo(() => specimenTexts(genome), [genome]);
  const palette = React.useMemo(() => specimenPalette(genome), [genome]);
  const styles = React.useMemo(() => {
    const defaults = defaultTextStyles(genome, deterministicId);
    const byName = (name: string) => t.styles.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? defaults.find((s) => s.name.toLowerCase() === name.toLowerCase())!;
    return {
      display: byName("Display"),
      h1: byName("H1"),
      h2: byName("H2"),
      h3: byName("H3"),
      subhead: byName("Subhead"),
      body: byName("Body"),
      small: byName("Body small"),
      caption: byName("Caption"),
      overline: byName("Overline"),
      button: byName("Button"),
    };
  }, [genome, t.styles]);
  const c = palette[mode];
  const css = (s: TypeStyle, extra?: React.CSSProperties): React.CSSProperties => {
    const f = t[s.font];
    return { fontFamily: fontStack(f.family, f.fallback), fontSize: s.size, fontWeight: s.weight, lineHeight: s.lineHeight, letterSpacing: `${s.letterSpacing}em`, textTransform: s.transform, margin: 0, ...extra };
  };
  const headlineStyle = texts.headline.length > 42 ? styles.h1 : styles.display;
  const sets = characterSets({ arabic: arabic && arabicAvailable });

  return (
    <Section
      id="type-specimen"
      title="Specimen"
      description={palette.light.branded ? "Set in the brand palette — what the type looks like on real surfaces." : "No palette yet, so the specimen uses the studio colours. Build one in the Color lab to see brand surfaces."}
      actions={
        <div className="flex items-center gap-3">
          <Switch checked={arabic && arabicAvailable} onChange={setArabic} label="Arabic sample" className={cn(!arabicAvailable && "opacity-50 pointer-events-none")} />
          <Tabs
            value={mode}
            onChange={setMode}
            items={[
              { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
              { value: "dark", label: "On dark", icon: <Moon className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
      }
    >
      {!arabicAvailable && <p className="text-[11px] text-fg-subtle -mt-2 mb-3">Arabic sample appears when the display or body family includes the Arabic subset (try Cairo, Tajawal, Readex Pro or Noto Naskh Arabic).</p>}
      <div className="rounded-lg border border-line overflow-hidden" style={{ background: c.bg, color: c.text }}>
        <div className="px-8 md:px-12 py-10 flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <p style={css(styles.overline, { color: c.primary })}>{texts.caption}</p>
            <h1 style={css(headlineStyle, { maxWidth: "18ch" })}>{texts.headline}</h1>
            <p style={css(styles.subhead, { color: c.muted, maxWidth: "48ch" })}>{texts.subhead}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-3 flex flex-col gap-4">
              <h2 style={css(styles.h2)}>{texts.brand}</h2>
              <p style={css(styles.body, { maxWidth: "62ch" })}>{texts.paragraph}</p>
              <p style={css(styles.body, { maxWidth: "62ch", color: c.muted })}>{texts.pangram}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span style={css(styles.button, { background: c.primary, color: mode === "dark" ? c.bg : "#FFFFFF", padding: "0.65em 1.2em", borderRadius: 8, display: "inline-block" })}>Get started</span>
                <span style={css(styles.button, { border: `1.5px solid ${c.primary}`, color: c.primary, padding: "0.65em 1.2em", borderRadius: 8, display: "inline-block" })}>Learn more</span>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col gap-3">
              <h3 style={css(styles.h3)}>What we stand for</h3>
              <ul className="flex flex-col gap-2 list-none p-0 m-0">
                {texts.list.map((item) => (
                  <li key={item} className="flex items-start gap-3" style={css(styles.small)}>
                    <span className="mt-[0.55em] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.primary }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p style={css(styles.caption, { color: c.muted })}>{texts.caption}</p>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col gap-4" style={{ borderColor: c.muted, opacity: 0.95 }}>
            <p style={css(styles.overline, { color: c.muted })}>Numerals, figures &amp; ligatures</p>
            <p style={css(styles.h3, { fontVariantNumeric: "tabular-nums" })}>{texts.numerals}</p>
            <p style={css({ ...styles.h2, font: "display" }, { fontFeatureSettings: '"liga", "dlig", "calt"' })}>{texts.ligatures}</p>
          </div>

          <div className="border-t pt-6 grid gap-3" style={{ borderColor: c.muted }}>
            {sets.map((set) => (
              <div key={set.id} className="grid grid-cols-[110px_1fr] gap-4 items-baseline">
                <span style={css(styles.caption, { color: c.muted })}>{set.label}</span>
                <p dir={set.rtl ? "rtl" : "ltr"} className="break-words leading-relaxed" style={css({ ...styles.h3, size: 20, lineHeight: 1.5, letterSpacing: 0.04, transform: "none" }, { color: c.text })}>
                  {set.glyphs.join(" ")}
                </p>
              </div>
            ))}
          </div>

          {arabic && arabicAvailable && (
            <div dir="rtl" lang="ar" className="border-t pt-6 flex flex-col gap-4" style={{ borderColor: c.muted }}>
              <p style={css(styles.overline, { color: c.primary, letterSpacing: 0 })}>{ARABIC_SAMPLE.caption}</p>
              <h2 style={css(styles.h1, { letterSpacing: 0, lineHeight: 1.3 })}>{ARABIC_SAMPLE.headline}</h2>
              <p style={css(styles.subhead, { color: c.muted, lineHeight: 1.6 })}>{ARABIC_SAMPLE.subhead}</p>
              <p style={css(styles.body, { maxWidth: "60ch", lineHeight: 1.9 })}>{ARABIC_SAMPLE.paragraph}</p>
              <p style={css(styles.h3, { letterSpacing: 0 })}>{ARABIC_SAMPLE.numerals}</p>
            </div>
          )}
        </div>
        <div className="px-8 md:px-12 py-3 flex flex-wrap gap-x-6 gap-y-1 border-t text-[11px]" style={{ borderColor: c.muted, color: c.muted, fontFamily: fontStack(t.mono.family, t.mono.fallback) }}>
          <span>display · {t.display.family}</span>
          <span>body · {t.body.family}</span>
          <span>mono · {t.mono.family}</span>
          <span>
            scale · {t.scale.base}px × {t.scale.ratio}
          </span>
          {c.branded && (
            <span className="ml-auto">
              {c.bg} / {c.text} / {c.primary}
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

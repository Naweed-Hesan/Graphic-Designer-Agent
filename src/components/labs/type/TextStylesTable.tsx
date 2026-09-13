"use client";
import * as React from "react";
import { Plus, Trash2, Wand2, LetterText } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Input, Select } from "@/components/ui";
import type { Genome, TypeStyle } from "@/lib/genome/schema";
import { defaultTextStyles, scaleMap } from "@/lib/type/scale";
import { fontStack } from "@/lib/type/fonts";
import { ALL_WEIGHTS, weightLabel } from "@/lib/type/fontmeta";
import { uid } from "@/lib/utils";
import { Section, SLOT_LABEL, SLOTS, type Slot } from "./shared";
import type { GenomeEdit } from "./hooks";

const PREVIEW_MAX = 40;
const cell = "h-8 text-[13px] px-2";

function StyleRow({ style, genome, brand, edit }: { style: TypeStyle; genome: Genome; brand: string; edit: GenomeEdit }) {
  const t = genome.visual.typography;
  const font = t[style.font];
  const patch = (fn: (s: TypeStyle) => void, summary: string, debounce = true) =>
    edit(
      (g) => {
        const s = g.visual.typography.styles.find((x) => x.id === style.id);
        if (s) fn(s);
      },
      summary,
      { debounce },
    );
  const num = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.valueAsNumber;
    return Number.isFinite(v) ? v : null;
  };
  return (
    <tr className="border-t border-line align-middle">
      <td className="p-1.5 min-w-[120px]">
        <Input className={cell} value={style.name} aria-label="Style name" onChange={(e) => patch((s) => void (s.name = e.target.value), `Renamed text style to ${e.target.value}`)} />
      </td>
      <td className="p-1.5 min-w-[130px]">
        <Select className={cell} value={style.font} aria-label="Font slot" onChange={(e) => patch((s) => void (s.font = e.target.value as Slot), `${style.name} → ${SLOT_LABEL[e.target.value as Slot]} font`, false)}>
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABEL[s]} · {t[s].family}
            </option>
          ))}
        </Select>
      </td>
      <td className="p-1.5 w-20">
        <Input
          className={cell}
          type="number"
          min={8}
          max={400}
          step={1}
          value={style.size}
          aria-label="Size in px"
          onChange={(e) => {
            const v = num(e);
            if (v !== null && v > 0) patch((s) => void (s.size = v), `${style.name} size → ${v}px`);
          }}
        />
      </td>
      <td className="p-1.5 min-w-[130px]">
        <Select className={cell} value={style.weight} aria-label="Weight" onChange={(e) => patch((s) => void (s.weight = Number(e.target.value)), `${style.name} weight → ${e.target.value}`, false)}>
          {[...new Set([...ALL_WEIGHTS, style.weight])]
            .sort((a, b) => a - b)
            .map((w) => (
              <option key={w} value={w}>
                {weightLabel(w)}
                {font.weights.includes(w) ? "" : " ·"}
              </option>
            ))}
        </Select>
      </td>
      <td className="p-1.5 w-20">
        <Input
          className={cell}
          type="number"
          min={0.8}
          max={3}
          step={0.05}
          value={style.lineHeight}
          aria-label="Line height"
          onChange={(e) => {
            const v = num(e);
            if (v !== null && v > 0) patch((s) => void (s.lineHeight = v), `${style.name} line-height → ${v}`);
          }}
        />
      </td>
      <td className="p-1.5 w-24">
        <Input
          className={cell}
          type="number"
          min={-0.1}
          max={0.5}
          step={0.005}
          value={style.letterSpacing}
          aria-label="Letter spacing in em"
          onChange={(e) => {
            const v = num(e);
            if (v !== null) patch((s) => void (s.letterSpacing = v), `${style.name} tracking → ${v}em`);
          }}
        />
      </td>
      <td className="p-1.5 min-w-[110px]">
        <Select className={cell} value={style.transform} aria-label="Text transform" onChange={(e) => patch((s) => void (s.transform = e.target.value as TypeStyle["transform"]), `${style.name} case → ${e.target.value}`, false)}>
          <option value="none">None</option>
          <option value="uppercase">Uppercase</option>
          <option value="lowercase">Lowercase</option>
          <option value="capitalize">Capitalize</option>
        </Select>
      </td>
      <td className="p-1.5 w-[240px] max-w-[240px]">
        <div
          className="truncate"
          title={`${style.size}px · ${font.family}`}
          style={{
            fontFamily: fontStack(font.family, font.fallback),
            fontSize: Math.min(style.size, PREVIEW_MAX),
            fontWeight: style.weight,
            lineHeight: 1.1,
            letterSpacing: `${style.letterSpacing}em`,
            textTransform: style.transform,
          }}
        >
          {brand}
        </div>
      </td>
      <td className="p-1.5 w-10">
        <Button variant="ghost" size="icon-sm" title={`Delete ${style.name}`} aria-label={`Delete ${style.name}`} onClick={() => edit((g) => void (g.visual.typography.styles = g.visual.typography.styles.filter((x) => x.id !== style.id)), `Deleted text style ${style.name}`)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

export function TextStylesTable({ genome, brand, edit }: { genome: Genome; brand: string; edit: GenomeEdit }) {
  const styles = genome.visual.typography.styles;

  const generate = () => {
    if (styles.length && !window.confirm(`Replace the ${styles.length} existing text style${styles.length === 1 ? "" : "s"} with generated defaults?`)) return;
    const next = defaultTextStyles(genome);
    edit((g) => void (g.visual.typography.styles = next), "Generated default text styles");
    toast.success(`Generated ${next.length} text styles from the scale`);
  };

  const add = () => {
    const s = scaleMap(genome.visual.typography.scale);
    const style: TypeStyle = { id: uid(8), name: `Style ${styles.length + 1}`, font: "body", size: Math.round(s.base), weight: 400, lineHeight: 1.5, letterSpacing: 0, transform: "none" };
    edit((g) => void g.visual.typography.styles.push(style), `Added text style ${style.name}`);
  };

  return (
    <Section
      id="type-styles"
      title="Text styles"
      description="Named styles exported as CSS classes and design tokens. Sizes are in px; tracking in em."
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={generate} title="Generate ten styles from the scale">
            <Wand2 className="h-3.5 w-3.5" /> Generate defaults
          </Button>
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add style
          </Button>
        </>
      }
    >
      {styles.length === 0 ? (
        <EmptyState
          icon={<LetterText className="h-8 w-8" />}
          title="No text styles yet"
          description="Generate Display, H1–H3, Subhead, Body, Caption, Overline and Button styles from the scale, then tune them."
          action={
            <Button onClick={generate}>
              <Wand2 className="h-4 w-4" /> Generate defaults
            </Button>
          }
        />
      ) : (
        <div className="inset overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="text-left font-semibold px-3 py-2">Name</th>
                <th className="text-left font-semibold px-3 py-2">Font</th>
                <th className="text-left font-semibold px-3 py-2">Size</th>
                <th className="text-left font-semibold px-3 py-2">Weight</th>
                <th className="text-left font-semibold px-3 py-2">Line</th>
                <th className="text-left font-semibold px-3 py-2">Tracking</th>
                <th className="text-left font-semibold px-3 py-2">Case</th>
                <th className="text-left font-semibold px-3 py-2">Preview</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {styles.map((s) => (
                <StyleRow key={s.id} style={s} genome={genome} brand={brand} edit={edit} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {styles.length > 0 && <p className="text-[11px] text-fg-subtle mt-2">Weights marked “·” are not loaded for that family — add them in the font browser or the CSS export will synthesise them. Previews are capped at {PREVIEW_MAX}px; see the specimen for true sizes.</p>}
    </Section>
  );
}

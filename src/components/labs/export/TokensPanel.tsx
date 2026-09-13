"use client";
import * as React from "react";
import { Copy, Download } from "lucide-react";
import { Button, Card, SectionHeader, Tabs } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { genomeToDtcg, genomeToTokensStudio, paletteToAse, paletteToCss, paletteToScss, paletteToTailwind, typographyToCss } from "@/lib/export/tokens";
import { paletteToGpl } from "@/lib/export/formats";
import { downloadBlob, formatBytes, slugify } from "@/lib/utils";

type TokenTab = "css" | "scss" | "tailwind" | "dtcg" | "tokens-studio" | "ase" | "gpl";

const TABS: { value: TokenTab; label: string }[] = [
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "tailwind", label: "Tailwind" },
  { value: "dtcg", label: "DTCG" },
  { value: "tokens-studio", label: "Tokens Studio" },
  { value: "ase", label: "ASE" },
  { value: "gpl", label: "GPL" },
];

interface TokenOutput {
  /** Text shown in the preview and copied to the clipboard */
  text: string;
  /** Bytes written on download */
  data: string | Uint8Array;
  filename: string;
  mime: string;
  note: string;
  copyLabel: string;
}

export function tokenOutput(genome: Genome, tab: TokenTab): TokenOutput {
  const slug = slugify(genome.name);
  switch (tab) {
    case "css": {
      const text = `${paletteToCss(genome)}\n${typographyToCss(genome)}`;
      return { text, data: text, filename: `${slug}-tokens.css`, mime: "text/css", note: "Custom properties for colour (with role aliases and dark-mode overrides) and typography, including the modular scale.", copyLabel: "Copy CSS" };
    }
    case "scss": {
      const t = genome.visual.typography;
      const text = `${paletteToScss(genome)}\n$font-display: "${t.display.family}", ${t.display.fallback};\n$font-body: "${t.body.family}", ${t.body.fallback};\n$font-mono: "${t.mono.family}", ${t.mono.fallback};\n$type-base: ${t.scale.base}px;\n$type-ratio: ${t.scale.ratio};\n`;
      return { text, data: text, filename: `${slug}-tokens.scss`, mime: "text/x-scss", note: "Sass variables for every colour plus font stacks and scale settings.", copyLabel: "Copy SCSS" };
    }
    case "tailwind": {
      const text = paletteToTailwind(genome);
      return { text, data: text, filename: `${slug}-tailwind.txt`, mime: "text/plain", note: "A Tailwind v4 @theme block and a v3 config extend — classes become bg-brand-<name>, text-brand-<name>, font-display, font-body.", copyLabel: "Copy Tailwind" };
    }
    case "dtcg": {
      const text = JSON.stringify(genomeToDtcg(genome), null, 2);
      return { text, data: text, filename: `${slug}-tokens.dtcg.json`, mime: "application/json", note: "W3C Design Tokens Community Group format — colour, font families, font sizes and motion, for Style Dictionary and friends.", copyLabel: "Copy JSON" };
    }
    case "tokens-studio": {
      const text = JSON.stringify(genomeToTokensStudio(genome), null, 2);
      return { text, data: text, filename: `${slug}-tokens-studio.json`, mime: "application/json", note: "Import into Figma with the Tokens Studio plugin (Tools → Load from file).", copyLabel: "Copy JSON" };
    }
    case "ase": {
      const bytes = paletteToAse(genome);
      const rows = genome.visual.palette.colors.map((c) => `${c.name.padEnd(24)} ${c.hex.toUpperCase()}`).join("\n");
      const text = `Adobe Swatch Exchange · ${genome.visual.palette.colors.length} RGB swatches · ${formatBytes(bytes.byteLength)}\nGroup: ${genome.name}\n\n${rows}\n`;
      return { text, data: bytes, filename: `${slug}.ase`, mime: "application/octet-stream", note: "Binary swatch library for Illustrator, Photoshop and InDesign (Swatches panel → Open Swatch Library → Other Library).", copyLabel: "Copy swatch list" };
    }
    case "gpl": {
      const text = paletteToGpl(genome);
      return { text, data: text, filename: `${slug}.gpl`, mime: "text/plain", note: "GIMP palette — also read by Inkscape, Krita, Aseprite and GTK colour pickers.", copyLabel: "Copy GPL" };
    }
  }
}

export function TokensPanel({ genome, onCopy }: { genome: Genome; onCopy: (text: string, label: string) => void }) {
  const [tab, setTab] = React.useState<TokenTab>("css");
  const out = React.useMemo(() => tokenOutput(genome, tab), [genome, tab]);
  const download = () => {
    const blob = out.data instanceof Uint8Array ? new Blob([out.data as BlobPart], { type: out.mime }) : new Blob([out.data], { type: `${out.mime};charset=utf-8` });
    downloadBlob(blob, out.filename);
  };
  const empty = genome.visual.palette.colors.length === 0;
  return (
    <Card>
      <SectionHeader
        title="Design tokens"
        description="The palette and type system in every format a design or engineering team will ask for."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => onCopy(out.text, out.copyLabel.replace("Copy ", ""))} title={out.copyLabel}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="secondary" size="sm" onClick={download} title={`Download ${out.filename}`}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </>
        }
      />
      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-3 max-w-full overflow-x-auto" />
      <p className="text-xs text-fg-muted mb-2">
        {out.note} <span className="font-mono text-fg-subtle">{out.filename}</span>
        {empty ? <span className="text-warning"> · The palette is empty — add colours in the Color lab to populate these files.</span> : null}
      </p>
      <pre className="inset p-3 font-mono text-[12px] leading-relaxed max-h-80 overflow-auto whitespace-pre text-fg" aria-label={`${out.filename} preview`}>
        {out.text}
      </pre>
    </Card>
  );
}

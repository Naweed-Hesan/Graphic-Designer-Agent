"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Tabs } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { genomeToDtcg, genomeToTokensStudio, hexToCmyk, paletteToAse, paletteToCss, paletteToScss, paletteToTailwind } from "@/lib/export/tokens";
import { downloadBlob, slugify } from "@/lib/utils";
import { BodyPortal, CopyButton } from "./shared";

type Tab = "css" | "scss" | "tailwind" | "dtcg" | "tokens" | "ase";

const FILES: Record<Exclude<Tab, "ase">, { ext: string; mime: string; label: string }> = {
  css: { ext: "css", mime: "text/css", label: "CSS variables" },
  scss: { ext: "scss", mime: "text/x-scss", label: "SCSS" },
  tailwind: { ext: "tailwind.txt", mime: "text/plain", label: "Tailwind" },
  dtcg: { ext: "tokens.json", mime: "application/json", label: "DTCG JSON" },
  tokens: { ext: "tokens-studio.json", mime: "application/json", label: "Tokens Studio" },
};

export function ExportDialog({ genome, onClose }: { genome: Genome; onClose: () => void }) {
  const [tab, setTab] = React.useState<Tab>("css");
  const text = React.useMemo<Record<Exclude<Tab, "ase">, string>>(
    () => ({
      css: paletteToCss(genome),
      scss: paletteToScss(genome),
      tailwind: paletteToTailwind(genome),
      dtcg: JSON.stringify(genomeToDtcg(genome), null, 2),
      tokens: JSON.stringify(genomeToTokensStudio(genome), null, 2),
    }),
    [genome],
  );
  const slug = slugify(genome.name);

  const downloadText = (t: Exclude<Tab, "ase">) => {
    downloadBlob(new Blob([text[t]], { type: FILES[t].mime }), `${slug}-palette.${FILES[t].ext}`);
  };
  const downloadAse = () => {
    const bytes = paletteToAse(genome);
    downloadBlob(new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }), `${slug}.ase`);
    toast.success("Swatch file downloaded — import it in Illustrator, Photoshop or InDesign");
  };

  return (
    <BodyPortal>
      <Dialog open onClose={onClose} title="Export palette" description="Design tokens straight from the Genome. The Export lab bundles these with everything else." wide>
        <Tabs
          value={tab}
          onChange={setTab}
          className="mb-4 flex-wrap"
          items={[
            { value: "css", label: "CSS" },
            { value: "scss", label: "SCSS" },
            { value: "tailwind", label: "Tailwind" },
            { value: "dtcg", label: "DTCG" },
            { value: "tokens", label: "Tokens Studio" },
            { value: "ase", label: "ASE" },
          ]}
        />
        {tab === "ase" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">
              Adobe Swatch Exchange with one RGB swatch per colour, grouped under “{genome.name}”. CMYK values below are a screen approximation — verify in your print profile.
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {genome.visual.palette.colors.map((c) => {
                const k = hexToCmyk(c.hex);
                return (
                  <li key={c.id} className="surface-2 flex items-center gap-3 px-2.5 py-2 text-sm">
                    <span className="h-8 w-8 rounded-md border border-black/10 shrink-0" style={{ background: c.hex }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[11px] font-mono text-fg-muted">
                        {c.hex.toUpperCase()} · C{k.c} M{k.m} Y{k.y} K{k.k}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end">
              <Button onClick={downloadAse}>
                <Download className="h-4 w-4" /> Download {slug}.ase
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-fg-muted">
                {FILES[tab].label} · {slug}-palette.{FILES[tab].ext}
              </span>
              <div className="flex items-center gap-1">
                <CopyButton text={text[tab]} label={FILES[tab].label}>
                  Copy
                </CopyButton>
                <Button variant="ghost" size="sm" onClick={() => downloadText(tab)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <pre className="inset p-3 font-mono text-[12px] leading-relaxed overflow-auto max-h-[52vh] whitespace-pre">{text[tab]}</pre>
          </div>
        )}
      </Dialog>
    </BodyPortal>
  );
}

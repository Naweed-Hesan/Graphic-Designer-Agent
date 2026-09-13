"use client";
import * as React from "react";
import { Check, Copy, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { typographyToCss } from "@/lib/export/tokens";
import { googleFontUrl } from "@/lib/type/fonts";
import { downloadBlob, slugify } from "@/lib/utils";
import { copyText } from "./shared";

/** One combined Google Fonts CSS2 URL for every Google-sourced family in the Genome. */
export function combinedGoogleFontsUrl(genome: Genome): string {
  const t = genome.visual.typography;
  // Reuse googleFontUrl's exact family encoding and merge the per-family URLs into one request.
  const params = [t.display, t.body, t.mono]
    .filter((f) => f.source === "google" && f.family)
    .map((f) => /[?&](family=[^&]+)/.exec(googleFontUrl(f.family, f.weights))?.[1])
    .filter((x): x is string => Boolean(x));
  return `https://fonts.googleapis.com/css2?${[...new Set(params)].join("&")}&display=swap`;
}

export function googleFontsLinkTags(genome: Genome): string {
  return [`<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, `<link href="${combinedGoogleFontsUrl(genome)}" rel="stylesheet">`].join("\n");
}

function CopyButton({ text, label, icon, onDone }: { text: string; label: string; icon?: React.ReactNode; onDone?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          toast.success(onDone ?? "Copied");
          setTimeout(() => setCopied(false), 1500);
        } else toast.error("Clipboard unavailable — select the code and copy manually");
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : (icon ?? <Copy className="h-3.5 w-3.5" />)} {label}
    </Button>
  );
}

export function ExportCssDialog({ open, onClose, genome }: { open: boolean; onClose: () => void; genome: Genome }) {
  const css = React.useMemo(() => typographyToCss(genome), [genome]);
  const link = React.useMemo(() => googleFontsLinkTags(genome), [genome]);
  return (
    <Dialog open={open} onClose={onClose} title="Export typography CSS" description="Custom properties for the families and scale, plus a class per text style." wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={css} label="Copy CSS" onDone="CSS copied" />
          <CopyButton text={link} label="Copy Google Fonts <link>" icon={<Link2 className="h-3.5 w-3.5" />} onDone="<link> tags copied" />
          <Button variant="secondary" size="sm" onClick={() => downloadBlob(new Blob([css], { type: "text/css" }), `${slugify(genome.name)}-typography.css`)}>
            <Download className="h-3.5 w-3.5" /> Download .css
          </Button>
        </div>
        <pre className="inset p-4 font-mono text-[12px] leading-relaxed overflow-auto max-h-[46vh] whitespace-pre text-fg-muted" aria-label="Typography CSS">
          {css}
        </pre>
        <div>
          <div className="label mb-1.5">HTML &lt;head&gt;</div>
          <pre className="inset p-3 font-mono text-[11px] leading-relaxed overflow-auto whitespace-pre text-fg-muted">{link}</pre>
        </div>
        <p className="text-xs text-fg-muted leading-relaxed">
          Google Fonts families are open source — almost all under the SIL Open Font License 1.1, a few under Apache 2.0 or the Ubuntu Font License. They are free for commercial use, embedding and self-hosting; OFL fonts may not be sold on their own and reserved font names must be kept when modifying. Check the licence page of each family on{" "}
          <a className="text-accent underline underline-offset-2" href="https://fonts.google.com" target="_blank" rel="noreferrer">
            fonts.google.com
          </a>{" "}
          before shipping a brand kit.
        </p>
      </div>
    </Dialog>
  );
}

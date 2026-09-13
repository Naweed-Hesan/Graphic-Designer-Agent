/**
 * Small text formats that ship in the brand kit: GIMP/Inkscape palettes, the
 * fonts manifest, a web manifest and the kit README. Pure, isomorphic.
 */
import type { Genome } from "@/lib/genome/schema";
import { hexToRgb } from "@/lib/color/contrast";
import { paletteColor } from "@/lib/logo/assets";
import { googleFontUrl } from "@/lib/type/fonts";
import { tokenName } from "./tokens";

/** GIMP palette (.gpl) — also read by Inkscape, Krita, Aseprite and GTK colour pickers. */
export function paletteToGpl(genome: Genome): string {
  const colors = genome.visual.palette.colors;
  const lines = [`GIMP Palette`, `Name: ${genome.name || "Palette"}`, `Columns: ${Math.max(1, Math.min(colors.length, 8))}`, `# Exported from Ligature — ${colors.length} colours`];
  for (const c of colors) {
    const [r, g, b] = hexToRgb(c.hex);
    lines.push(`${String(r).padStart(3, " ")} ${String(g).padStart(3, " ")} ${String(b).padStart(3, " ")}\t${c.name} (${c.hex.toUpperCase()})`);
  }
  return lines.join("\n") + "\n";
}

export interface FontLine {
  role: "display" | "body" | "mono";
  family: string;
  category: string;
  weights: number[];
  source: string;
  url: string;
  cssVar: string;
}

export function fontLines(genome: Genome): FontLine[] {
  const t = genome.visual.typography;
  return (["display", "body", "mono"] as const).map((role) => {
    const f = t[role];
    return {
      role,
      family: f.family,
      category: f.category,
      weights: [...new Set(f.weights.length ? f.weights : [400])].sort((a, b) => a - b),
      source: f.source,
      url: f.source === "google" ? googleFontUrl(f.family, f.weights.length ? f.weights : [400]) : "",
      cssVar: `--font-${role}`,
    };
  });
}

/** `typography/fonts.txt` — families, weights, where to get them and the licensing note. */
export function fontsTxt(genome: Genome): string {
  const lines: string[] = [`${genome.name} — typefaces`, "=".repeat(Math.min(72, genome.name.length + 12)), ""];
  for (const f of fontLines(genome)) {
    lines.push(`${f.role.toUpperCase()}`);
    lines.push(`  Family:   ${f.family}`);
    lines.push(`  Category: ${f.category}`);
    lines.push(`  Weights:  ${f.weights.join(", ")}`);
    lines.push(`  Source:   ${f.source === "google" ? "Google Fonts" : f.source === "system" ? "System font (no files needed)" : "Custom font — files supplied separately"}`);
    if (f.url) lines.push(`  CSS:      ${f.url}`);
    lines.push(`  CSS var:  ${f.cssVar}`);
    lines.push("");
  }
  const googleFamilies = fontLines(genome).filter((f) => f.source === "google");
  if (googleFamilies.length) {
    const combined = `https://fonts.googleapis.com/css2?${googleFamilies.map((f) => `family=${f.family.replace(/\s+/g, "+")}:wght@${f.weights.join(";")}`).join("&")}&display=swap`;
    lines.push("One <link> for everything:");
    lines.push(`  <link rel="stylesheet" href="${combined}">`);
    lines.push("");
  }
  lines.push("Licensing");
  lines.push("  Google Fonts families are published under the SIL Open Font License, Apache 2.0 or Ubuntu Font License —");
  lines.push("  free for commercial use, self-hosting and embedding. Check the licence on each family's page at fonts.google.com");
  lines.push("  before modifying or redistributing font files. Custom and system fonts are governed by their own licences;");
  lines.push("  confirm desktop, web and app rights with the foundry before shipping.");
  lines.push("");
  lines.push(`Type scale: base ${genome.visual.typography.scale.base}px, ratio ${genome.visual.typography.scale.ratio}. See typography.css.`);
  return lines.join("\n") + "\n";
}

/** `logo/favicon/site.webmanifest` */
export function siteWebmanifest(genome: Genome): string {
  const primary = paletteColor(genome, "primary", "#1f1f1f");
  const background = paletteColor(genome, "background", "#ffffff");
  const words = genome.name.trim().split(/\s+/);
  return JSON.stringify(
    {
      name: genome.name,
      short_name: words.length > 2 ? words.slice(0, 2).join(" ") : genome.name,
      description: genome.strategy.tagline || genome.strategy.positioning || undefined,
      icons: [
        { src: "android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: primary,
      background_color: background,
      display: "standalone",
    },
    null,
    2,
  );
}

export interface ReadmeContext {
  placeholderLogo: boolean;
  generatedOn: string;
  groups: { id: string; label: string; included: boolean; count: number }[];
}

/** The kit's top-level README.md. */
export function kitReadme(genome: Genome, ctx: ReadmeContext): string {
  const t = genome.visual.typography;
  const colors = genome.visual.palette.colors;
  const primary = colors.find((c) => c.role === "primary");
  const tree = [
    "README.md                    this file",
    "genome.json                  the Brand Genome — import it into Ligature to keep editing",
    "guidelines/guidelines.html   self-contained brand guidelines (open in a browser, print to PDF)",
    "logo/svg/                    vector logo variants",
    "logo/png/                    transparent PNGs at @1x / @2x / @4x",
    "logo/favicon/                favicon.ico, apple-touch-icon, Android icons, site.webmanifest",
    "color/                       design tokens in every common format",
    "typography/                  typography.css and fonts.txt",
    "social/                      profile avatars and platform cover images",
    "imagery/                     reference and generated imagery",
    "mockups/                     application mockups",
    "motion/                      logo animations and brand video",
  ];
  const included = ctx.groups.filter((g) => g.included);
  const excluded = ctx.groups.filter((g) => !g.included);
  const lines: string[] = [];
  lines.push(`# ${genome.name} — brand kit`);
  lines.push("");
  if (genome.strategy.tagline) lines.push(`*${genome.strategy.tagline}*`, "");
  lines.push(`Generated ${ctx.generatedOn} with Ligature from the Brand Genome (schema v${genome.schemaVersion}).`);
  if (genome.brief.clientName) lines.push(`Client: ${genome.brief.clientName}${genome.brief.projectName ? ` · ${genome.brief.projectName}` : ""}.`);
  lines.push("");
  if (ctx.placeholderLogo) {
    lines.push("> **Note:** no final logo artwork existed when this kit was built. The files in `logo/`, `social/` and the");
    lines.push("> guidelines use generated placeholders (brand initials in the display typeface). Rebuild the kit once the");
    lines.push("> Logo stage is complete.");
    lines.push("");
  }
  lines.push("## What's inside");
  lines.push("");
  lines.push("```");
  lines.push(...tree);
  lines.push("```");
  lines.push("");
  lines.push("Included: " + included.map((g) => `${g.label} (${g.count})`).join(", ") + ".");
  if (excluded.length) lines.push("Left out of this build: " + excluded.map((g) => g.label).join(", ") + ".");
  lines.push("");
  lines.push("## Using the tokens");
  lines.push("");
  lines.push("- **CSS** — `color/palette.css` defines `--brand-<name>` custom properties plus role aliases (`--brand-primary`, `--brand-accent`…). Import it once and use `var(--brand-primary)`.");
  lines.push("- **SCSS** — `color/palette.scss` exposes the same colours as `$brand-<name>` variables.");
  lines.push("- **Tailwind** — `color/tailwind.txt` has a v4 `@theme` block and a v3 `tailwind.config.js` extend; classes become `bg-brand-<name>`, `text-brand-<name>`.");
  lines.push("- **Design tokens (W3C DTCG)** — `color/tokens.dtcg.json` is the vendor-neutral format for Style Dictionary, Terrazzo and similar pipelines.");
  lines.push("- **Figma** — import `color/tokens-studio.json` with the Tokens Studio plugin.");
  lines.push("- **Adobe** — load `color/palette.ase` into Illustrator, Photoshop or InDesign swatches.");
  lines.push("- **GIMP / Inkscape / Krita** — import `color/palette.gpl`.");
  lines.push("- **Typography** — `typography/typography.css` sets `--font-display`, `--font-body`, `--font-mono` and a modular scale (`--text-xs` … `--text-5xl`).");
  lines.push("");
  if (primary) {
    lines.push("```css");
    lines.push(`.button { background: var(--brand-${tokenName(primary)}); font-family: var(--font-body); }`);
    lines.push("```");
    lines.push("");
  }
  lines.push("## Logo");
  lines.push("");
  lines.push(`- Minimum size: ${genome.visual.logo.minSizePx}px on screen, ${genome.visual.logo.minSizeMm}mm in print.`);
  lines.push(`- Clearspace: ${genome.visual.logo.clearspaceMultiplier === 1 ? "x" : genome.visual.logo.clearspaceMultiplier + "x"} on every side, where x is a quarter of the logo's height.`);
  for (const r of genome.visual.logo.usageRules) lines.push(`- ${r}`);
  for (const r of genome.visual.logo.doNots) lines.push(`- Never: ${r}`);
  lines.push("");
  lines.push("## Fonts and licensing");
  lines.push("");
  lines.push(`Display **${t.display.family}**, body **${t.body.family}**, mono **${t.mono.family}**. See \`typography/fonts.txt\` for weights and Google Fonts links.`);
  lines.push("Google Fonts families are open-source (OFL/Apache) and free for commercial use; custom fonts are licensed separately — check desktop, web and app rights before shipping.");
  lines.push("");
  lines.push("## Guidelines");
  lines.push("");
  lines.push("Open `guidelines/guidelines.html` in any browser. Use *Print → Save as PDF* for a paginated PDF; page size and breaks are already defined.");
  lines.push("");
  return lines.join("\n");
}

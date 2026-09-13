/**
 * Developer handoff README and the one-paragraph identity summary. Pure.
 */
import type { Genome } from "@/lib/genome/schema";
import { ARCHETYPES } from "@/lib/genome/archetypes";
import { hexToRgb } from "@/lib/color/contrast";
import { fontLines } from "./formats";
import { tokenName } from "./tokens";

function sentence(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/** Markdown quick reference a developer can drop into a repo README. */
export function developerReadme(genome: Genome): string {
  const s = genome.strategy;
  const t = genome.visual.typography;
  const colors = genome.visual.palette.colors;
  const arche = ARCHETYPES.find((a) => a.id === s.archetype);
  const primary = colors.find((c) => c.role === "primary");
  const out: string[] = [];
  out.push(`# ${genome.name} — brand quick reference`);
  out.push("");
  if (s.tagline) out.push(`> ${s.tagline}`, "");
  const summary = [s.positioning && sentence(s.positioning), arche && `Archetype: ${arche.name}${s.secondaryArchetype ? ` with ${ARCHETYPES.find((a) => a.id === s.secondaryArchetype)?.name ?? ""}` : ""} — ${arche.voice.toLowerCase()}.`, s.values.length && `Values: ${s.values.join(", ")}.`]
    .filter(Boolean)
    .join(" ");
  if (summary) out.push(summary, "");

  if (colors.length) {
    out.push("## Palette", "");
    out.push("| Token | Hex | RGB | Role | Usage |");
    out.push("| --- | --- | --- | --- | --- |");
    for (const c of colors) {
      const [r, g, b] = hexToRgb(c.hex);
      out.push(`| \`--brand-${tokenName(c)}\` | \`${c.hex.toUpperCase()}\` | ${r}, ${g}, ${b} | ${c.role} | ${c.usage.replace(/\|/g, "\\|")} |`);
    }
    const dark = Object.entries(genome.visual.palette.dark);
    if (dark.length) {
      out.push("");
      out.push("Dark mode overrides: " + dark.map(([id, hex]) => `${colors.find((c) => c.id === id)?.name ?? id} → \`${hex.toUpperCase()}\``).join(", ") + ".");
    }
    out.push("");
  }

  out.push("## Typography", "");
  for (const f of fontLines(genome)) out.push(`- **${f.role[0].toUpperCase() + f.role.slice(1)}:** ${f.family} (${f.category}; weights ${f.weights.join(", ")})${f.url ? ` — [Google Fonts](${f.url})` : ""}`);
  out.push(`- **Scale:** base ${t.scale.base}px, ratio ${t.scale.ratio}`);
  if (t.styles.length) {
    out.push("");
    out.push("| Style | Font | Size | Weight | Line height | Tracking |");
    out.push("| --- | --- | --- | --- | --- | --- |");
    for (const st of t.styles) out.push(`| ${st.name} | ${st.font} | ${st.size}px | ${st.weight} | ${st.lineHeight} | ${st.letterSpacing}em |`);
  }
  out.push("");

  out.push("## Usage", "");
  out.push("```css");
  out.push(`@import "./color/palette.css";`);
  out.push(`@import "./typography/typography.css";`);
  out.push("");
  out.push(`body { font-family: var(--font-body); color: ${colors.find((c) => c.role === "text") ? `var(--brand-${tokenName(colors.find((c) => c.role === "text")!)})` : "#111"}; }`);
  out.push(`h1, h2, h3 { font-family: var(--font-display); }`);
  if (primary) out.push(`.button-primary { background: var(--brand-${tokenName(primary)}); color: ${bestOn(primary.hex)}; }`);
  out.push("```");
  out.push("");
  out.push(`- Logo: minimum ${genome.visual.logo.minSizePx}px on screen, ${genome.visual.logo.minSizeMm}mm in print; keep ${genome.visual.logo.clearspaceMultiplier === 1 ? "x" : genome.visual.logo.clearspaceMultiplier + "x"} clearspace (x = ¼ logo height).`);
  for (const r of genome.visual.logo.usageRules) out.push(`- ${r}`);
  for (const r of genome.visual.logo.doNots) out.push(`- Never: ${r}`);
  out.push(`- Motion: \`${genome.visual.motion.easing}\`, base duration ${genome.visual.motion.durationBase}ms.`);
  if (s.tone.voice) out.push(`- Voice: ${sentence(s.tone.voice)}`);
  out.push("");
  out.push("Full guidelines: `guidelines/guidelines.html`. Tokens in DTCG, Tokens Studio, ASE and GPL formats live in `color/`.");
  return out.join("\n") + "\n";
}

function bestOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.35 ? "#000" : "#fff";
}

/** One paragraph a designer can paste into an email or a deck note. */
export function identitySummary(genome: Genome): string {
  const s = genome.strategy;
  const b = genome.brief;
  const t = genome.visual.typography;
  const colors = genome.visual.palette.colors;
  const primary = colors.find((c) => c.role === "primary");
  const accent = colors.find((c) => c.role === "accent");
  const secondary = colors.find((c) => c.role === "secondary");
  const arche = ARCHETYPES.find((a) => a.id === s.archetype);
  const parts: string[] = [];

  const who = [b.industry && `a ${b.industry.toLowerCase()} brand`, b.audience && `for ${b.audience.replace(/\.$/, "")}`].filter(Boolean).join(" ");
  parts.push(who ? `${genome.name} is ${who}.` : `${genome.name} is a brand identity built in Ligature.`);
  if (s.positioning) parts.push(sentence(s.positioning));
  if (arche) parts.push(`It carries ${arche.name.replace(/^The /, "the ")} archetype — ${arche.voice.toLowerCase()}${s.values.length ? ` — and stands for ${listify(s.values.map((v) => v.toLowerCase()))}` : ""}.`);
  else if (s.values.length) parts.push(`It stands for ${listify(s.values.map((v) => v.toLowerCase()))}.`);
  const palette = [primary && `${primary.name} (${primary.hex.toUpperCase()})`, secondary && `${secondary.name} (${secondary.hex.toUpperCase()})`].filter(Boolean).join(" and ");
  if (palette) parts.push(`The palette is led by ${palette}${accent ? `, with ${accent.name} (${accent.hex.toUpperCase()}) as the accent` : ""}, set in ${t.display.family} for display and ${t.body.family} for text.`);
  else parts.push(`Typography pairs ${t.display.family} for display with ${t.body.family} for text.`);
  if (genome.visual.logo.concept) parts.push(`The logo: ${sentence(genome.visual.logo.concept.charAt(0).toLowerCase() + genome.visual.logo.concept.slice(1))}`);
  if (genome.visual.imagery.medium || genome.visual.imagery.mood.length) parts.push(`Imagery is ${[genome.visual.imagery.medium && genome.visual.imagery.medium.toLowerCase(), genome.visual.imagery.mood.length && `${listify(genome.visual.imagery.mood)} in mood`].filter(Boolean).join(", ")}.`);
  if (s.tone.voice) parts.push(`Voice: ${sentence(s.tone.voice.charAt(0).toLowerCase() + s.tone.voice.slice(1))}`);
  if (s.tagline) parts.push(`Tagline: “${s.tagline}”`);
  return parts.join(" ");
}

function listify(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Guidelines renderers: shared document CSS (used by the React viewer and the
 * standalone file), a self-contained HTML export and a Markdown export.
 * Pure string builders — no React, no DOM.
 */
import type { GuidelinesDoc, GuidelinesSection, ImageRef, ContrastPair } from "./model";
import { sanitizeSvg } from "@/lib/logo/svg";
import { tableOfContents } from "./model";
import { parseCubicBezier } from "@/lib/export/tokens";

export type PageSize = "A4" | "Letter";

export const PAGE_SIZES: Record<PageSize, { label: string; width: string; height: string; note: string }> = {
  A4: { label: "A4", width: "210mm", height: "297mm", note: "210 × 297 mm" },
  Letter: { label: "Letter", width: "8.5in", height: "11in", note: "8.5 × 11 in" },
};

export interface RenderOptions {
  /** Convert every image reference into a data URL so the file is self-contained. */
  inlineAssets?: boolean;
  /** Called per image reference when `inlineAssets` is true; return a data URL or undefined to keep the current src. */
  resolveAsset?: (ref: ImageRef) => Promise<string | undefined>;
  pageSize?: PageSize;
  /** Extra text for the colophon (e.g. the generator name). */
  generator?: string;
}

/* ────────────────────────────── utilities ────────────────────────────── */

export function esc(s: string | number | undefined | null): string {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function googleFontsHref(fonts: { family: string; weights: number[] }[]): string {
  if (!fonts.length) return "";
  const fam = fonts.map((f) => `family=${f.family.trim().replace(/\s+/g, "+")}:wght@${[...new Set(f.weights)].sort((a, b) => a - b).join(";")}`).join("&");
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

const NAMED_EASINGS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

export function easingToBezier(easing: string): [number, number, number, number] {
  const key = easing.trim().toLowerCase();
  if (NAMED_EASINGS[key]) return NAMED_EASINGS[key];
  return parseCubicBezier(easing);
}

/** A small easing-curve figure with control handles. */
export function easingCurveSvg(easing: string, stroke = "#111", accent = "#e0553f"): string {
  const [x1, y1, x2, y2] = easingToBezier(easing);
  const S = 160;
  const pad = 20;
  const px = (v: number) => pad + v * (S - pad * 2);
  const py = (v: number) => S - pad - v * (S - pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect x="${pad}" y="${pad}" width="${S - pad * 2}" height="${S - pad * 2}" fill="none" stroke="${stroke}" stroke-opacity="0.18"/><line x1="${px(0)}" y1="${py(0)}" x2="${px(x1)}" y2="${py(y1)}" stroke="${accent}" stroke-opacity="0.6"/><line x1="${px(1)}" y1="${py(1)}" x2="${px(x2)}" y2="${py(y2)}" stroke="${accent}" stroke-opacity="0.6"/><path d="M ${px(0)} ${py(0)} C ${px(x1)} ${py(y1)}, ${px(x2)} ${py(y2)}, ${px(1)} ${py(1)}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/><circle cx="${px(x1)}" cy="${py(y1)}" r="3.5" fill="${accent}"/><circle cx="${px(x2)}" cy="${py(y2)}" r="3.5" fill="${accent}"/></svg>`;
}

export const SPECIMEN_GLYPHS = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
export const SPECIMEN_FIGURES = "0123456789 &@#%!?¶§ ({[«»]})";

/* ────────────────────────────── CSS ────────────────────────────── */

export function guidelinesCss(doc: GuidelinesDoc, opts: { pageSize?: PageSize; standalone?: boolean } = {}): string {
  const t = doc.theme;
  const page = PAGE_SIZES[opts.pageSize ?? "A4"];
  const vars = `--gl-paper:${t.paper};--gl-ink:${t.ink};--gl-muted:${t.muted};--gl-rule:${t.rule};--gl-primary:${t.primary};--gl-on-primary:${t.onPrimary};--gl-accent:${t.accent};--gl-on-accent:${t.onAccent};--gl-display:${t.displayStack};--gl-body:${t.bodyStack};--gl-mono:${t.monoStack};--gl-ok:#1f8a4c;--gl-no:#c8372d;--gl-page-w:${page.width};--gl-page-h:${page.height};`;
  return `
.gl-doc{${vars}background:var(--gl-paper);color:var(--gl-ink);font-family:var(--gl-body);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"kern","liga";overflow-wrap:break-word;container-type:inline-size;}
.gl-doc *,.gl-doc *::before,.gl-doc *::after{box-sizing:border-box;}
.gl-doc img{max-width:100%;display:block;}
.gl-doc p{margin:0 0 1em;}
.gl-doc a{color:inherit;}
.gl-page{padding:64px 72px 72px;max-width:960px;margin:0 auto;border-top:1px solid var(--gl-rule);}
.gl-head{margin:0 0 36px;padding:0 0 20px;border-bottom:1px solid var(--gl-ink);display:flex;flex-direction:column;gap:8px;}
.gl-eyebrow{font-family:var(--gl-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gl-muted);}
.gl-h2{font-family:var(--gl-display);font-weight:400;font-size:46px;line-height:1.02;letter-spacing:-.015em;margin:0;}
.gl-lede{font-size:19px;line-height:1.5;max-width:34em;margin:0 0 32px;}
.gl-h3{font-family:var(--gl-display);font-weight:400;font-size:26px;line-height:1.15;letter-spacing:-.01em;margin:44px 0 14px;}
.gl-h3:first-child{margin-top:0;}
.gl-label{font-size:11.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--gl-muted);margin:0 0 10px;}
.gl-prose{max-width:64ch;}
.gl-prose p:last-child{margin-bottom:0;}
.gl-muted{color:var(--gl-muted);}
.gl-small{font-size:13px;}
.gl-mono{font-family:var(--gl-mono);font-size:12.5px;}
.gl-grid{display:grid;gap:24px 32px;}
.gl-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}
.gl-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}
.gl-block{margin:0 0 36px;}
.gl-avoid{break-inside:avoid;}
.gl-list{margin:0;padding:0;list-style:none;}
.gl-list li{padding:9px 0;border-top:1px solid var(--gl-rule);}
.gl-list li:last-child{border-bottom:1px solid var(--gl-rule);}
.gl-list-num li{display:grid;grid-template-columns:32px 1fr;gap:12px;}
.gl-list-num li>span:first-child{font-family:var(--gl-mono);font-size:11.5px;color:var(--gl-muted);padding-top:3px;}
.gl-marks li{display:grid;grid-template-columns:22px 1fr;gap:10px;}
.gl-marks li>span:first-child{font-weight:700;font-size:14px;line-height:1.6;}
.gl-do li>span:first-child{color:var(--gl-ok);}
.gl-dont li>span:first-child{color:var(--gl-no);}
.gl-chips{display:flex;flex-wrap:wrap;gap:8px;}
.gl-chip{border:1px solid var(--gl-rule);border-radius:999px;padding:4px 12px;font-size:13px;line-height:1.4;}
.gl-chip-no{text-decoration:line-through;color:var(--gl-muted);}
.gl-dl{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px 20px;font-size:14px;margin:0;}
.gl-dl dt{color:var(--gl-muted);font-weight:500;}
.gl-dl dd{margin:0;}
.gl-quote{font-family:var(--gl-display);font-size:28px;line-height:1.25;letter-spacing:-.01em;margin:28px 0;padding-left:20px;border-left:3px solid var(--gl-accent);max-width:28em;}
.gl-quote small{display:block;font-family:var(--gl-body);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gl-muted);margin-top:10px;}
.gl-values{display:flex;flex-wrap:wrap;gap:8px 28px;font-family:var(--gl-display);font-size:36px;line-height:1.15;letter-spacing:-.01em;}
.gl-axes{display:grid;gap:14px;max-width:640px;}
.gl-axis{display:grid;grid-template-columns:110px minmax(0,1fr) 110px;align-items:center;gap:14px;font-size:13px;}
.gl-axis-r{text-align:right;}
.gl-axis-track{position:relative;height:2px;background:var(--gl-rule);}
.gl-axis-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:var(--gl-primary);transform:translate(-50%,-50%);}
.gl-arche{border:1px solid var(--gl-rule);border-radius:8px;padding:22px 24px;}
.gl-arche-name{font-family:var(--gl-display);font-size:30px;line-height:1.1;margin:0 0 6px;}
.gl-cover{background:var(--gl-primary);color:var(--gl-on-primary);border-top:0;max-width:none;min-height:760px;display:flex;flex-direction:column;justify-content:space-between;padding:56px 72px 48px;}
.gl-cover-logo{height:60px;width:260px;}
.gl-cover-logo>svg{height:100%;width:100%;}
.gl-cover-title{font-family:var(--gl-display);font-weight:400;font-size:clamp(56px,9vw,112px);line-height:.98;letter-spacing:-.025em;margin:0;max-width:10em;}
.gl-cover-tagline{font-size:22px;line-height:1.35;opacity:.88;margin:22px 0 0;max-width:24em;}
.gl-cover-kicker{font-family:var(--gl-mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin:0 0 22px;}
.gl-cover-meta{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;font-family:var(--gl-mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.85;border-top:1px solid currentColor;padding-top:16px;margin-top:64px;}
.gl-logo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;}
.gl-logo-tile{border:1px solid var(--gl-rule);border-radius:8px;padding:28px;display:flex;flex-direction:column;gap:18px;background:var(--gl-paper);}
.gl-logo-tile[data-surface="ink"]{background:var(--gl-ink);color:var(--gl-paper);border-color:transparent;}
.gl-logo-tile[data-surface="primary"]{background:var(--gl-primary);color:var(--gl-on-primary);border-color:transparent;}
.gl-logo{height:120px;display:flex;align-items:center;justify-content:center;}
.gl-logo>svg{width:100%;height:100%;}
.gl-logo-caption{font-family:var(--gl-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.75;display:flex;justify-content:space-between;gap:12px;}
.gl-figure{border:1px solid var(--gl-rule);border-radius:8px;padding:24px;background:var(--gl-paper);}
.gl-figure>svg{width:100%;height:auto;max-height:340px;display:block;}
.gl-minsize{display:flex;gap:44px;align-items:flex-end;flex-wrap:wrap;}
.gl-minsize-item{display:flex;flex-direction:column;gap:10px;align-items:flex-start;}
.gl-logo-min>svg{height:100%;width:auto;display:block;}
.gl-minsize .gl-caption{margin:0;font-family:var(--gl-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
.gl-caption{font-size:12.5px;color:var(--gl-muted);margin:10px 0 0;}
.gl-swatches{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;}
.gl-swatch{border:1px solid var(--gl-rule);border-radius:8px;overflow:hidden;}
.gl-swatch-chip{height:132px;padding:14px 16px;display:flex;flex-direction:column;justify-content:flex-end;font-family:var(--gl-mono);font-size:12px;letter-spacing:.04em;}
.gl-swatch-meta{padding:12px 16px 14px;}
.gl-swatch-name{font-weight:600;font-size:14.5px;line-height:1.3;}
.gl-swatch-role{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gl-muted);margin:2px 0 10px;}
.gl-swatch-row{display:flex;justify-content:space-between;gap:12px;font-family:var(--gl-mono);font-size:11.5px;padding:4px 0;border-top:1px solid var(--gl-rule);}
.gl-swatch-row span:first-child{color:var(--gl-muted);}
.gl-swatch-usage{font-size:12.5px;color:var(--gl-muted);margin:10px 0 0;line-height:1.45;}
.gl-table{width:100%;border-collapse:collapse;font-size:13px;}
.gl-table th{text-align:left;font-weight:600;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gl-muted);padding:8px 12px 8px 0;border-bottom:1px solid var(--gl-ink);}
.gl-table td{padding:10px 12px 10px 0;border-bottom:1px solid var(--gl-rule);vertical-align:middle;}
.gl-table .gl-mono{font-size:12px;}
.gl-pair{display:inline-flex;align-items:center;gap:10px;}
.gl-pair-chip{width:48px;height:30px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-family:var(--gl-display);font-size:17px;border:1px solid rgba(0,0,0,.1);flex:none;}
.gl-pass{color:var(--gl-ok);font-weight:600;}
.gl-fail{color:var(--gl-no);font-weight:600;}
.gl-specimen{border-top:1px solid var(--gl-ink);padding:22px 0 28px;}
.gl-specimen-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;}
.gl-specimen-family{font-size:15px;font-weight:600;}
.gl-specimen-meta{font-family:var(--gl-mono);font-size:11px;color:var(--gl-muted);letter-spacing:.06em;}
.gl-specimen-big{font-size:48px;line-height:1.08;margin:18px 0 10px;letter-spacing:-.01em;}
.gl-specimen-glyphs{font-size:19px;line-height:1.5;overflow-wrap:anywhere;}
.gl-specimen-figures{font-size:15px;line-height:1.5;color:var(--gl-muted);margin-top:4px;overflow-wrap:anywhere;}
.gl-scale{list-style:none;padding:0;margin:0;}
.gl-scale li{display:grid;grid-template-columns:56px minmax(0,1fr) 150px;align-items:baseline;gap:16px;border-top:1px solid var(--gl-rule);padding:10px 0;}
.gl-scale li:last-child{border-bottom:1px solid var(--gl-rule);}
.gl-scale .gl-sample{font-family:var(--gl-display);line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gl-scale .gl-mono{text-align:right;color:var(--gl-muted);white-space:nowrap;}
.gl-styles li{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:16px;align-items:baseline;}
.gl-images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;}
.gl-images figure{margin:0;}
.gl-images img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid var(--gl-rule);background:var(--gl-rule);}
.gl-images figcaption{font-size:12px;color:var(--gl-muted);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gl-icon-row{display:flex;gap:14px;align-items:center;flex-wrap:wrap;}
.gl-icon-row svg{width:40px;height:40px;}
.gl-motion{display:grid;grid-template-columns:180px minmax(0,1fr);gap:28px;align-items:start;}
.gl-durations li{display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:12px;}
.gl-durations .gl-mono{text-align:right;}
.gl-colophon{font-size:14px;}
.gl-stages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 24px;margin:0;padding:0;list-style:none;font-size:13px;}
.gl-stages li{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--gl-rule);padding:6px 0;}
.gl-stages .gl-mono{color:var(--gl-muted);}
.gl-print-btn{position:fixed;top:16px;right:16px;z-index:10;background:var(--gl-ink);color:var(--gl-paper);border:0;border-radius:999px;padding:10px 16px;font:600 13px/1 var(--gl-body);cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.18);}
@container (max-width:900px){
.gl-page{padding:52px 44px 56px;}
.gl-cover{padding:44px 44px 36px;min-height:640px;}
.gl-h2{font-size:40px;}
.gl-grid-3,.gl-swatches,.gl-images{grid-template-columns:repeat(2,minmax(0,1fr));}
.gl-motion{grid-template-columns:160px minmax(0,1fr);}
}
@container (max-width:600px){
.gl-page{padding:36px 22px 44px;}
.gl-cover{padding:32px 22px 28px;min-height:520px;}
.gl-cover-title{font-size:clamp(40px,13cqw,80px);}
.gl-h2{font-size:34px;}
.gl-lede{font-size:17px;}
.gl-grid-2,.gl-grid-3,.gl-logo-grid,.gl-swatches,.gl-images,.gl-motion,.gl-stages{grid-template-columns:minmax(0,1fr);}
.gl-dl{grid-template-columns:minmax(0,1fr);gap:2px 0;}
.gl-dl dd{margin-bottom:10px;}
.gl-axis{grid-template-columns:76px minmax(0,1fr) 76px;}
.gl-values{font-size:28px;}
.gl-quote{font-size:22px;}
.gl-specimen-big{font-size:34px;}
.gl-scale li{grid-template-columns:44px minmax(0,1fr) 110px;}
}
@page{size:${page.label};margin:16mm 16mm 18mm;}
@page :first{margin:0;}
@media print{
${opts.standalone ? "html,body{margin:0;padding:0;background:#fff;}" : ""}
.gl-doc{font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.gl-doc *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.gl-print-btn{display:none;}
.gl-page{max-width:none;margin:0;padding:0;border:0;break-before:page;page-break-before:always;}
.gl-cover{break-before:auto;page-break-before:auto;height:calc(var(--gl-page-h) - 1mm);min-height:0;padding:18mm 18mm 14mm;}
.gl-cover-title{font-size:64pt;}
.gl-h2{font-size:30pt;}
.gl-h3{font-size:18pt;break-after:avoid;page-break-after:avoid;}
.gl-lede{font-size:13pt;}
.gl-head{break-after:avoid;page-break-after:avoid;}
.gl-avoid,.gl-swatch,.gl-logo-tile,.gl-figure,.gl-specimen,.gl-arche,.gl-quote,.gl-images figure,tr{break-inside:avoid;page-break-inside:avoid;}
.gl-quote{font-size:18pt;}
.gl-values{font-size:24pt;}
.gl-specimen-big{font-size:34pt;}
.gl-logo{height:34mm;}
.gl-swatch-chip{height:28mm;}
.gl-figure>svg{max-height:90mm;}
}
`;
}

/* ────────────────────────────── HTML ────────────────────────────── */

const svgInline = (svg: string) => sanitizeSvg(svg);

function contrastRow(p: ContrastPair): string {
  const r = p.report;
  const pass = (ok: boolean) => `<span class="${ok ? "gl-pass" : "gl-fail"}">${ok ? "Pass" : "Fail"}</span>`;
  return `<tr><td><span class="gl-pair"><span class="gl-pair-chip" style="background:${p.bg.hex};color:${p.fg.hex}">Aa</span><span>${esc(p.fg.name)} on ${esc(p.bg.name)}</span></span></td><td class="gl-mono">${esc(p.fg.hex)} / ${esc(p.bg.hex)}</td><td class="gl-mono">${r.ratio.toFixed(2)}:1</td><td>${pass(r.aaNormal)}</td><td>${pass(r.aaLarge)}</td><td class="gl-mono">${r.apca > 0 ? "+" : ""}${r.apca}</td><td class="gl-small gl-muted">${esc(r.apcaUse)}</td></tr>`;
}

function head(s: GuidelinesSection, lede?: string): string {
  return `<header class="gl-head"><div class="gl-eyebrow">Section ${esc(s.number)}</div><h2 class="gl-h2">${esc(s.title)}</h2></header>${lede ? `<p class="gl-lede">${esc(lede)}</p>` : ""}`;
}

function list(items: string[], cls = ""): string {
  return `<ul class="gl-list ${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}
function marks(items: string[], kind: "do" | "dont"): string {
  return `<ul class="gl-list gl-marks gl-${kind}">${items.map((i) => `<li><span>${kind === "do" ? "✓" : "✕"}</span><span>${esc(i)}</span></li>`).join("")}</ul>`;
}
function chips(items: string[], cls = ""): string {
  return `<div class="gl-chips">${items.map((i) => `<span class="gl-chip ${cls}">${esc(i)}</span>`).join("")}</div>`;
}

function renderSection(s: GuidelinesSection, doc: GuidelinesDoc, srcOf: (r: ImageRef) => string): string {
  const t = doc.theme;
  switch (s.kind) {
    case "cover":
      return `<section class="gl-page gl-cover" id="gl-${s.id}"><div><div class="gl-cover-logo">${svgInline(s.logo.svg)}</div></div><div><p class="gl-cover-kicker">Brand guidelines</p><h1 class="gl-cover-title">${esc(s.name)}</h1>${s.tagline ? `<p class="gl-cover-tagline">${esc(s.tagline)}</p>` : ""}<div class="gl-cover-meta"><span>${esc(s.client || s.name)}</span><span>Version ${esc(s.version)}</span><span>${esc(s.date)}</span></div></div></section>`;
    case "intro": {
      const quotes = [s.mission && `<blockquote class="gl-quote">${esc(s.mission)}<small>Mission</small></blockquote>`, s.vision && `<blockquote class="gl-quote">${esc(s.vision)}<small>Vision</small></blockquote>`].filter(Boolean).join("");
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.positioning)}<div class="gl-prose">${s.story.map((p) => `<p>${esc(p)}</p>`).join("")}</div>${quotes}${s.audience ? `<div class="gl-block" style="margin-top:32px"><div class="gl-label">Audience</div><p class="gl-prose">${esc(s.audience)}</p></div>` : ""}</section>`;
    }
    case "strategy": {
      const axes = s.personality.length
        ? `<div class="gl-block gl-avoid"><div class="gl-label">Personality</div><div class="gl-axes">${s.personality.map((a) => `<div class="gl-axis"><span>${esc(a.left)}</span><span class="gl-axis-track"><span class="gl-axis-dot" style="left:${a.value}%"></span></span><span class="gl-axis-r">${esc(a.right)}</span></div>`).join("")}</div></div>`
        : "";
      const arche = s.archetype
        ? `<div class="gl-block gl-avoid"><div class="gl-label">Archetype</div><div class="gl-arche"><div class="gl-arche-name">${esc(s.archetype.name)}${s.secondaryArchetype ? ` <span class="gl-muted">with ${esc(s.secondaryArchetype.name)}</span>` : ""}</div><dl class="gl-dl"><dt>Drive</dt><dd>${esc(s.archetype.drive)}</dd><dt>Voice</dt><dd>${esc(s.archetype.voice)}</dd><dt>In the wild</dt><dd>${esc(s.archetype.examples)}</dd><dt>Palette cues</dt><dd>${esc(s.archetype.colors)}</dd></dl></div></div>`
        : "";
      return `<section class="gl-page" id="gl-${s.id}">${head(s)}${s.values.length ? `<div class="gl-block"><div class="gl-label">Values</div><div class="gl-values">${s.values.map(esc).join("")}</div></div>` : ""}${arche}${axes}${s.differentiators.length ? `<div class="gl-block"><div class="gl-label">What sets us apart</div>${list(s.differentiators)}</div>` : ""}${s.keywords.length ? `<div class="gl-block"><div class="gl-label">Keywords</div>${chips(s.keywords)}</div>` : ""}</section>`;
    }
    case "voice":
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.voice)}${s.sample ? `<blockquote class="gl-quote">${esc(s.sample)}<small>Sample copy</small></blockquote>` : ""}<div class="gl-grid gl-grid-2">${s.dos.length ? `<div><div class="gl-label">Do</div>${marks(s.dos, "do")}</div>` : ""}${s.donts.length ? `<div><div class="gl-label">Don't</div>${marks(s.donts, "dont")}</div>` : ""}</div></section>`;
    case "logo":
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.concept)}${s.placeholder ? `<p class="gl-small gl-muted">The artwork below is a generated placeholder — the final logo replaces it automatically once it exists.</p>` : ""}<div class="gl-logo-grid">${s.variants.map((v) => `<div class="gl-logo-tile gl-avoid" data-surface="${v.surface}"><div class="gl-logo">${svgInline(v.svg)}</div><div class="gl-logo-caption"><span>${esc(v.label)}</span><span>${v.placeholder ? "placeholder" : "svg"}</span></div></div>`).join("")}</div><h3 class="gl-h3">Clearspace</h3><div class="gl-grid gl-grid-2 gl-avoid"><div class="gl-figure">${svgInline(s.clearspace.svg)}</div><p class="gl-prose">${esc(s.clearspace.description)}</p></div><h3 class="gl-h3">Minimum size</h3><div class="gl-grid gl-grid-2 gl-avoid"><div class="gl-figure gl-minsize"><div class="gl-minsize-item"><div class="gl-logo-min" style="height:${s.minSize.px}px">${svgInline(s.minSize.svg)}</div><span class="gl-caption">${s.minSize.px} px · screen</span></div><div class="gl-minsize-item"><div class="gl-logo-min" style="height:${s.minSize.mm}mm">${svgInline(s.minSize.svg)}</div><span class="gl-caption">${s.minSize.mm} mm · print</span></div></div><p class="gl-prose">Never reproduce the mark smaller than <strong>${s.minSize.px} px</strong> on screen or <strong>${s.minSize.mm} mm</strong> in print. Below these sizes detail is lost and the mark stops reading.</p></div>${s.usageRules.length || s.doNots.length ? `<h3 class="gl-h3">Usage</h3><div class="gl-grid gl-grid-2">${s.usageRules.length ? `<div><div class="gl-label">Rules</div>${marks(s.usageRules, "do")}</div>` : ""}${s.doNots.length ? `<div><div class="gl-label">Never</div>${marks(s.doNots, "dont")}</div>` : ""}</div>` : ""}</section>`;
    case "color":
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.rationale)}<div class="gl-swatches">${s.swatches
        .map(
          (c) =>
            `<div class="gl-swatch gl-avoid"><div class="gl-swatch-chip" style="background:${c.hex};color:${c.textOn}"></div><div class="gl-swatch-meta"><div class="gl-swatch-name">${esc(c.name)}</div><div class="gl-swatch-role">${esc(c.role)}</div><div class="gl-swatch-row"><span>HEX</span><span>${esc(c.hex)}</span></div><div class="gl-swatch-row"><span>RGB</span><span>${esc(c.rgbText)}</span></div><div class="gl-swatch-row"><span>CMYK</span><span>${esc(c.cmykText)}</span></div>${c.darkHex ? `<div class="gl-swatch-row"><span>DARK</span><span>${esc(c.darkHex)}</span></div>` : ""}${c.usage ? `<p class="gl-swatch-usage">${esc(c.usage)}</p>` : ""}</div></div>`,
        )
        .join("")}</div>${
        s.contrast.length
          ? `<h3 class="gl-h3">Accessible pairings</h3><p class="gl-prose gl-small gl-muted">WCAG 2.2 ratios and APCA lightness contrast for the combinations used most. AA normal text needs 4.5:1, large text 3:1.</p><table class="gl-table"><thead><tr><th>Pairing</th><th>Values</th><th>Ratio</th><th>AA text</th><th>AA large</th><th>APCA</th><th>Use for</th></tr></thead><tbody>${s.contrast.map(contrastRow).join("")}</tbody></table>`
          : ""
      }${
        s.dark.length
          ? `<h3 class="gl-h3">Dark mode</h3><table class="gl-table"><thead><tr><th>Colour</th><th>Light</th><th>Dark</th></tr></thead><tbody>${s.dark.map((d) => `<tr><td>${esc(d.name)}</td><td><span class="gl-pair"><span class="gl-pair-chip" style="background:${d.light}"></span><span class="gl-mono">${esc(d.light)}</span></span></td><td><span class="gl-pair"><span class="gl-pair-chip" style="background:${d.dark}"></span><span class="gl-mono">${esc(d.dark)}</span></span></td></tr>`).join("")}</tbody></table>`
          : ""
      }</section>`;
    case "typography": {
      const specimens = s.fonts
        .map(
          (f) =>
            `<div class="gl-specimen gl-avoid" style="font-family:${f.stack}"><div class="gl-specimen-head"><span class="gl-specimen-family" style="font-family:var(--gl-body)">${esc(f.label)} · ${esc(f.spec.family)}</span><span class="gl-specimen-meta">${esc(f.spec.category)} · ${f.spec.weights.join(" / ")}${f.spec.variable ? " · variable" : ""} · ${esc(f.spec.source)}</span></div><div class="gl-specimen-big" style="font-weight:${f.role === "display" ? (f.spec.weights.includes(400) ? 400 : f.spec.weights[0] ?? 400) : f.spec.weights[0] ?? 400}">${esc(f.role === "mono" ? "const brand = { name: \"" + doc.brand.name + "\" };" : f.role === "display" ? s.sampleHeadline : s.sampleBody)}</div><div class="gl-specimen-glyphs">${SPECIMEN_GLYPHS}</div><div class="gl-specimen-figures">${SPECIMEN_FIGURES}</div></div>`,
        )
        .join("");
      const ladder = `<ul class="gl-scale">${s.scale.steps
        .map((st) => `<li><span class="gl-mono" style="text-align:left">${esc(st.name)}</span><span class="gl-sample" style="font-size:${Math.min(st.px, 72)}px">${esc(doc.brand.name)}</span><span class="gl-mono">${st.px}px · ${st.rem}rem</span></li>`)
        .join("")}</ul>`;
      const styles = s.styles.length
        ? `<h3 class="gl-h3">Text styles</h3><ul class="gl-list gl-styles">${s.styles
            .map(
              (st) =>
                `<li><span style="font-family:var(--gl-${st.font});font-size:${Math.min(st.size, 40)}px;font-weight:${st.weight};line-height:${st.lineHeight};letter-spacing:${st.letterSpacing}em;text-transform:${st.transform}">${esc(st.name)}</span><span class="gl-mono gl-muted">${st.size}px / ${st.lineHeight} · ${st.weight}${st.letterSpacing ? ` · ${st.letterSpacing}em` : ""}</span></li>`,
            )
            .join("")}</ul>`
        : "";
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.rationale)}${specimens}<h3 class="gl-h3">Type scale</h3><p class="gl-prose gl-small gl-muted">Base ${s.scale.base}px, ratio ${s.scale.ratio}. Sizes are rounded to two decimals; use rem in code.</p>${ladder}${styles}</section>`;
    }
    case "imagery": {
      const attrs = s.attributes.length ? `<dl class="gl-dl gl-block">${s.attributes.map((a) => `<dt>${esc(a.label)}</dt><dd>${esc(a.value)}</dd>`).join("")}</dl>` : "";
      const refs = s.references.length ? `<h3 class="gl-h3">${esc(s.referencesLabel)}</h3><div class="gl-images">${s.references.map((r) => `<figure><img src="${esc(srcOf(r))}" alt="${esc(r.name)}"${r.width ? ` width="${r.width}"` : ""}${r.height ? ` height="${r.height}"` : ""}/><figcaption>${esc(r.caption || r.name)}</figcaption></figure>`).join("")}</div>` : "";
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.guidance)}${attrs}<div class="gl-grid gl-grid-2 gl-block">${s.mood.length ? `<div><div class="gl-label">Mood</div>${chips(s.mood)}</div>` : ""}${s.avoid.length ? `<div><div class="gl-label">Avoid</div>${chips(s.avoid, "gl-chip-no")}</div>` : ""}</div>${refs}</section>`;
    }
    case "elements": {
      const icon = `<div class="gl-block gl-avoid"><div class="gl-label">Icon style</div><div class="gl-icon-row">${iconSamples(s.iconStyle, t.ink)}<span class="gl-small gl-muted">${esc(s.iconStyle.style)} · ${s.iconStyle.strokeWidth}px stroke · ${s.iconStyle.cornerRadius}px corners</span></div></div>`;
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.notes)}<div class="gl-grid gl-grid-2 gl-block">${s.shapes.length ? `<div><div class="gl-label">Shapes</div>${list(s.shapes)}</div>` : ""}${s.patterns.length ? `<div><div class="gl-label">Patterns</div>${list(s.patterns)}</div>` : ""}</div>${icon}</section>`;
    }
    case "motion":
      return `<section class="gl-page" id="gl-${s.id}">${head(s, s.notes)}<div class="gl-motion gl-block"><div class="gl-figure" style="padding:12px">${easingCurveSvg(s.easing, t.ink, t.accent)}</div><div><div class="gl-label">Easing</div><p class="gl-mono">${esc(s.easing)}</p><div class="gl-label" style="margin-top:18px">Durations · base ${s.durationBase} ms${s.preset ? ` · logo preset “${esc(s.preset)}”` : ""}</div><ul class="gl-list gl-durations">${s.durations.map((d) => `<li><span>${esc(d.name)}</span><span class="gl-mono">${d.ms} ms</span></li>`).join("")}</ul></div></div>${s.principles.length ? `<div class="gl-label">Principles</div><ul class="gl-list gl-list-num">${s.principles.map((p, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><span>${esc(p)}</span></li>`).join("")}</ul>` : ""}</section>`;
    case "applications":
      return `<section class="gl-page" id="gl-${s.id}">${head(s, "The identity in use. Every application follows the logo, colour and type rules in this document.")}<div class="gl-images">${s.images.map((r) => `<figure><img src="${esc(srcOf(r))}" alt="${esc(r.name)}"${r.width ? ` width="${r.width}"` : ""}${r.height ? ` height="${r.height}"` : ""}/><figcaption>${esc(r.caption || r.name)}</figcaption></figure>`).join("")}</div></section>`;
    case "colophon":
      return `<section class="gl-page gl-colophon" id="gl-${s.id}">${head(s)}<div class="gl-grid gl-grid-2"><dl class="gl-dl">${s.client ? `<dt>Client</dt><dd>${esc(s.client)}</dd>` : ""}${s.project ? `<dt>Project</dt><dd>${esc(s.project)}</dd>` : ""}${s.industry ? `<dt>Industry</dt><dd>${esc(s.industry)}</dd>` : ""}<dt>Version</dt><dd>${esc(s.version)}</dd><dt>Issued</dt><dd>${esc(s.date)}</dd><dt>Typefaces</dt><dd>${s.fonts.map((f) => `${esc(f.spec.family)} (${esc(f.label.toLowerCase())})`).join(", ")}</dd>${s.deliverables.length ? `<dt>Deliverables</dt><dd>${s.deliverables.map(esc).join(", ")}</dd>` : ""}</dl><div><div class="gl-label">Programme status</div><ul class="gl-stages">${s.stages.map((st) => `<li><span>${esc(st.label)}</span><span class="gl-mono">${esc(st.status)}</span></li>`).join("")}</ul></div></div><p class="gl-small gl-muted" style="margin-top:40px">These guidelines are generated from the Brand Genome and stay in sync with it. Typefaces are served from Google Fonts unless noted; check each family's licence before self-hosting.</p></section>`;
  }
}

export function iconSamples(style: { style: string; strokeWidth: number; cornerRadius: number }, ink: string): string {
  const sw = style.strokeWidth;
  const r = style.cornerRadius;
  const filled = style.style === "filled";
  const duo = style.style === "duotone";
  const fill = filled ? ink : duo ? ink : "none";
  const fillOpacity = duo ? 0.2 : 1;
  const stroke = filled ? "none" : ink;
  const common = `fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="${r}" ${common}/></svg><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" ${common}/></svg><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 18 L12 5 L20 18 Z" ${common}/></svg><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 16 C 8 6, 16 6, 20 16" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/><path d="M4 12 h16" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-opacity="${duo ? 0.4 : 1}"/></svg>`;
}

/** Self-contained HTML document with embedded CSS and (optionally) data-URL assets. */
export async function renderStandaloneHtml(doc: GuidelinesDoc, opts: RenderOptions = {}): Promise<string> {
  const { inlineAssets = true, resolveAsset, pageSize = "A4", generator = "Ligature" } = opts;
  const resolved = new Map<string, string>();
  if (inlineAssets) {
    const refs: ImageRef[] = [];
    for (const s of doc.sections) {
      if (s.kind === "imagery") refs.push(...s.references);
      if (s.kind === "applications") refs.push(...s.images);
    }
    for (const r of refs) {
      if (r.src.startsWith("data:")) {
        resolved.set(r.assetId, r.src);
        continue;
      }
      try {
        const data = resolveAsset ? await resolveAsset(r) : undefined;
        if (data) resolved.set(r.assetId, data);
      } catch {
        /* keep original src */
      }
    }
  }
  const srcOf = (r: ImageRef) => resolved.get(r.assetId) ?? r.src;
  const fontsHref = googleFontsHref(doc.googleFonts);
  const toc = tableOfContents(doc);
  const title = `${doc.brand.name} — Brand guidelines`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="generator" content="${esc(generator)}"/>
<meta name="description" content="${esc(`Brand guidelines for ${doc.brand.name}, version ${doc.version}, ${doc.date}.`)}"/>
${fontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com"/>\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>\n<link rel="stylesheet" href="${esc(fontsHref)}"/>` : ""}
<style>
html,body{margin:0;padding:0;background:${doc.theme.paper};}
${guidelinesCss(doc, { pageSize, standalone: true })}
</style>
</head>
<body>
<button class="gl-print-btn" type="button" onclick="window.print()">Print or save as PDF</button>
<article class="gl-doc" data-version="${esc(doc.version)}" data-date="${esc(doc.dateIso)}">
${doc.sections.map((s) => renderSection(s, doc, srcOf)).join("\n")}
</article>
<nav hidden aria-label="Contents">${toc.map((t) => `<a href="#gl-${esc(t.id)}">${esc(t.number)} ${esc(t.title)}</a>`).join("")}</nav>
</body>
</html>`;
}

/** Section body HTML without the document shell (used by the kit README preview etc.). */
export function renderSectionHtml(s: GuidelinesSection, doc: GuidelinesDoc): string {
  return renderSection(s, doc, (r) => r.src);
}

/* ────────────────────────────── Markdown ────────────────────────────── */

const mdEsc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

export function renderMarkdown(doc: GuidelinesDoc): string {
  const out: string[] = [];
  const line = (s = "") => out.push(s);
  const para = (s: string) => {
    out.push(s);
    out.push("");
  };
  for (const s of doc.sections) {
    switch (s.kind) {
      case "cover":
        line(`# ${s.name} — Brand guidelines`);
        if (s.tagline) line(`*${s.tagline}*`);
        line();
        line(`Version ${s.version} · ${s.date}${s.client ? ` · ${s.client}` : ""}`);
        line();
        break;
      case "intro":
        line(`## ${s.number} ${s.title}`);
        line();
        for (const p of s.story) para(p);
        if (s.mission) para(`> **Mission** — ${s.mission}`);
        if (s.vision) para(`> **Vision** — ${s.vision}`);
        if (s.audience) para(`**Audience.** ${s.audience}`);
        break;
      case "strategy":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.values.length) para(`**Values:** ${s.values.join(" · ")}`);
        if (s.archetype) {
          line(`**Archetype:** ${s.archetype.name}${s.secondaryArchetype ? ` (with ${s.secondaryArchetype.name})` : ""} — ${s.archetype.drive}. Voice: ${s.archetype.voice}.`);
          line();
        }
        if (s.personality.length) {
          line(`| Axis | Position |`);
          line(`| --- | --- |`);
          for (const a of s.personality) line(`| ${mdEsc(a.left)} ↔ ${mdEsc(a.right)} | ${a.value}% towards ${a.value >= 50 ? mdEsc(a.right) : mdEsc(a.left)} |`);
          line();
        }
        if (s.differentiators.length) {
          line(`**What sets us apart**`);
          line();
          for (const d of s.differentiators) line(`- ${d}`);
          line();
        }
        if (s.keywords.length) para(`**Keywords:** ${s.keywords.join(", ")}`);
        break;
      case "voice":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.voice) para(s.voice);
        if (s.sample) para(`> ${s.sample}`);
        if (s.dos.length) {
          line(`**Do**`);
          line();
          for (const d of s.dos) line(`- ✓ ${d}`);
          line();
        }
        if (s.donts.length) {
          line(`**Don't**`);
          line();
          for (const d of s.donts) line(`- ✕ ${d}`);
          line();
        }
        break;
      case "logo":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.concept) para(s.concept);
        line(`**Variants:** ${s.variants.map((v) => v.label + (v.placeholder ? " (placeholder)" : "")).join(", ")}`);
        line();
        line(`**Clearspace.** ${s.clearspace.description}`);
        line();
        line(`**Minimum size.** ${s.minSize.px} px on screen, ${s.minSize.mm} mm in print.`);
        line();
        if (s.usageRules.length) {
          line(`**Rules**`);
          line();
          for (const r of s.usageRules) line(`- ✓ ${r}`);
          line();
        }
        if (s.doNots.length) {
          line(`**Never**`);
          line();
          for (const r of s.doNots) line(`- ✕ ${r}`);
          line();
        }
        break;
      case "color":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.rationale) para(s.rationale);
        line(`| Name | Role | HEX | RGB | CMYK | Usage |`);
        line(`| --- | --- | --- | --- | --- | --- |`);
        for (const c of s.swatches) line(`| ${mdEsc(c.name)} | ${c.role} | \`${c.hex}\` | ${c.rgbText} | ${c.cmykText} | ${mdEsc(c.usage)} |`);
        line();
        if (s.contrast.length) {
          line(`**Accessible pairings**`);
          line();
          line(`| Pairing | Ratio | AA text | AA large | APCA | Use for |`);
          line(`| --- | --- | --- | --- | --- | --- |`);
          for (const p of s.contrast) line(`| ${mdEsc(p.fg.name)} on ${mdEsc(p.bg.name)} | ${p.report.ratio.toFixed(2)}:1 | ${p.report.aaNormal ? "pass" : "fail"} | ${p.report.aaLarge ? "pass" : "fail"} | ${p.report.apca} | ${p.report.apcaUse} |`);
          line();
        }
        if (s.dark.length) {
          line(`**Dark mode**`);
          line();
          line(`| Colour | Light | Dark |`);
          line(`| --- | --- | --- |`);
          for (const d of s.dark) line(`| ${mdEsc(d.name)} | \`${d.light}\` | \`${d.dark}\` |`);
          line();
        }
        break;
      case "typography":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.rationale) para(s.rationale);
        for (const f of s.fonts) line(`- **${f.label}:** ${f.spec.family} (${f.spec.category}; weights ${f.spec.weights.join(", ")}; ${f.spec.source})`);
        line();
        line(`**Type scale** — base ${s.scale.base}px, ratio ${s.scale.ratio}`);
        line();
        line(`| Step | px | rem |`);
        line(`| --- | --- | --- |`);
        for (const st of s.scale.steps) line(`| ${st.name} | ${st.px} | ${st.rem} |`);
        line();
        if (s.styles.length) {
          line(`**Text styles**`);
          line();
          for (const st of s.styles) line(`- ${st.name}: ${st.font} ${st.size}px / ${st.lineHeight}, weight ${st.weight}${st.letterSpacing ? `, tracking ${st.letterSpacing}em` : ""}${st.transform !== "none" ? `, ${st.transform}` : ""}`);
          line();
        }
        break;
      case "imagery":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.guidance) para(s.guidance);
        for (const a of s.attributes) line(`- **${a.label}:** ${a.value}`);
        if (s.attributes.length) line();
        if (s.mood.length) para(`**Mood:** ${s.mood.join(", ")}`);
        if (s.avoid.length) para(`**Avoid:** ${s.avoid.join(", ")}`);
        if (s.references.length) para(`**${s.referencesLabel}:** ${s.references.map((r) => r.name).join(", ")}`);
        break;
      case "elements":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.notes) para(s.notes);
        if (s.shapes.length) para(`**Shapes:** ${s.shapes.join(", ")}`);
        if (s.patterns.length) para(`**Patterns:** ${s.patterns.join(", ")}`);
        line(`**Icons:** ${s.iconStyle.style}, ${s.iconStyle.strokeWidth}px stroke, ${s.iconStyle.cornerRadius}px corners`);
        line();
        break;
      case "motion":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.notes) para(s.notes);
        line(`**Easing:** \`${s.easing}\` · **Base duration:** ${s.durationBase} ms${s.preset ? ` · **Logo preset:** ${s.preset}` : ""}`);
        line();
        for (const d of s.durations) line(`- ${d.name}: ${d.ms} ms`);
        line();
        if (s.principles.length) {
          for (const [i, p] of s.principles.entries()) line(`${i + 1}. ${p}`);
          line();
        }
        break;
      case "applications":
        line(`## ${s.number} ${s.title}`);
        line();
        for (const r of s.images) line(`- ${r.name}`);
        line();
        break;
      case "colophon":
        line(`## ${s.number} ${s.title}`);
        line();
        if (s.client) line(`- Client: ${s.client}`);
        if (s.project) line(`- Project: ${s.project}`);
        if (s.industry) line(`- Industry: ${s.industry}`);
        line(`- Version: ${s.version}`);
        line(`- Issued: ${s.date}`);
        line(`- Typefaces: ${s.fonts.map((f) => `${f.spec.family} (${f.label.toLowerCase()})`).join(", ")}`);
        if (s.deliverables.length) line(`- Deliverables: ${s.deliverables.join(", ")}`);
        line();
        line(`Generated from the Brand Genome with Ligature.`);
        break;
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

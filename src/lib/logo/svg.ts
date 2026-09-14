/**
 * Pure SVG string helpers for the Logo lab: colour mapping, tight viewBoxes,
 * lockup composition and clearspace guides. Everything works on strings so it
 * is isomorphic; only `fitViewBox` touches the DOM (and no-ops without one).
 */
import { svgSize } from "@/lib/raster";

export const SVG_NS = "http://www.w3.org/2000/svg";
export const XLINK_NS = "http://www.w3.org/1999/xlink";

const ROOT_TAG = /<svg\b([^>]*?)(\/?)>/i;
const ATTR = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Parse an SVG string into an <svg> element (browser only; null on the server or on invalid markup). */
export function parseSvg(svg: string): SVGSVGElement | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length) return null;
  const root = doc.documentElement;
  return root && root.tagName.toLowerCase() === "svg" ? (root as unknown as SVGSVGElement) : null;
}

export function serializeSvg(el: Element): string {
  return new XMLSerializer().serializeToString(el);
}

/** Drop XML prolog, doctype, scripts and inline event handlers from user-supplied SVG. */
const DANGEROUS_TAGS = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "animate", "set", "handler", "listener"]);

/** Regex pass used on the server and as a first line of defence in the browser. */
function sanitizeSvgText(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!ENTITY[\s\S]*?>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "")
    .trim();
}

/**
 * Removes anything executable or network-reaching from an SVG document:
 * scripts, foreignObject, event-handler attributes, javascript: URLs and
 * external href targets. Uses the DOM parser in the browser (which sees
 * attribute forms a regex cannot) and the text pass on the server.
 */
export function sanitizeSvg(svg: string): string {
  const text = sanitizeSvgText(svg);
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return text;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, "image/svg+xml");
  } catch {
    return text;
  }
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || doc.querySelector("parsererror")) return text;
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (DANGEROUS_TAGS.has(child.localName.toLowerCase())) {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith("on") || value.startsWith("javascript:") || value.startsWith("data:text/html")) child.removeAttribute(attr.name);
        else if ((name === "href" || name === "xlink:href") && /^(https?:)?\/\//.test(value) && child.localName.toLowerCase() !== "a") child.removeAttribute(attr.name);
      }
      walk(child);
    }
  };
  for (const attr of Array.from(root.attributes)) if (attr.name.toLowerCase().startsWith("on")) root.removeAttribute(attr.name);
  walk(root);
  return new XMLSerializer().serializeToString(root);
}

/** Attributes of the root <svg> tag. */
export function svgRootAttrs(svg: string): Record<string, string> {
  const m = ROOT_TAG.exec(svg);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const a of m[1].matchAll(ATTR)) out[a[1]] = a[2] ?? a[3] ?? "";
  return out;
}

/** Markup between the root <svg …> and its closing tag. */
export function svgInner(svg: string): string {
  const m = ROOT_TAG.exec(svg);
  if (!m) return svg;
  if (m[2] === "/") return "";
  const start = m.index + m[0].length;
  const end = svg.lastIndexOf("</svg>");
  return end > start ? svg.slice(start, end) : svg.slice(start);
}

/** Set (or remove with `null`) attributes on the root <svg> tag. */
export function setRootAttrs(svg: string, attrs: Record<string, string | number | null>): string {
  const m = ROOT_TAG.exec(svg);
  if (!m) return svg;
  const current = svgRootAttrs(svg);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null) delete current[k];
    else current[k] = String(v);
  }
  if (!current.xmlns) current.xmlns = SVG_NS;
  const attrStr = Object.entries(current)
    .map(([k, v]) => ` ${k}="${v.replace(/"/g, "&quot;")}"`)
    .join("");
  return svg.slice(0, m.index) + `<svg${attrStr}${m[2]}>` + svg.slice(m.index + m[0].length);
}

/** Root <svg> with a viewBox and no fixed size, so it fills its container in inline previews. */
export function toResponsiveSvg(svg: string): string {
  const size = svgSize(svg);
  const attrs = svgRootAttrs(svg);
  return setRootAttrs(sanitizeSvg(svg), {
    viewBox: attrs.viewBox ?? `0 0 ${size.width} ${size.height}`,
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid meet",
  });
}

/** Wrap inner markup in a root <svg> of the given size. */
export function wrapSvg(width: number, height: number, inner: string, extra: Record<string, string> = {}): string {
  const attrs = Object.entries(extra)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  return `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" viewBox="0 0 ${r3(width)} ${r3(height)}" width="${r3(width)}" height="${r3(height)}"${attrs}>${inner}</svg>`;
}

const DROP_ON_EMBED = new Set(["xmlns", "width", "height", "viewBox", "x", "y", "version", "id", "preserveAspectRatio", "baseProfile", "xml:space", "enable-background"]);

/** Nest an SVG inside another at a given box, preserving its aspect ratio and root presentation attributes. */
export function embedSvg(svg: string, x: number, y: number, width: number, height: number): string {
  const clean = sanitizeSvg(svg);
  const attrs = svgRootAttrs(clean);
  const size = svgSize(clean);
  const viewBox = attrs.viewBox ?? `0 0 ${size.width} ${size.height}`;
  const keep = Object.entries(attrs)
    .filter(([k]) => !DROP_ON_EMBED.has(k) && !k.startsWith("xmlns:"))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  return `<svg x="${r3(x)}" y="${r3(y)}" width="${r3(width)}" height="${r3(height)}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"${keep}>${svgInner(clean)}</svg>`;
}

// ── Colours ────────────────────────────────────────────────────────────────

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  navy: "#000080",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  teal: "#008080",
  aqua: "#00ffff",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  olive: "#808000",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
};

const NON_PAINT = new Set(["none", "transparent", "currentcolor", "inherit", "initial", "unset"]);

/** Normalise a CSS paint value to lowercase 6-digit hex; null for none/url()/unknown. */
export function normalizeColor(value: string): string | null {
  const s = value.trim().toLowerCase();
  if (!s || NON_PAINT.has(s) || s.startsWith("url(") || s.startsWith("var(")) return null;
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    return `#${h.slice(0, 6)}`;
  }
  const rgb = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)/.exec(s);
  if (rgb) {
    const ch = (v: string) => {
      const n = v.endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v);
      return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
    };
    return `#${ch(rgb[1])}${ch(rgb[2])}${ch(rgb[3])}`;
  }
  return NAMED[s] ?? null;
}

/** Is this paint value "no paint" (none, transparent, url(#gradient)…)? */
export function isNonPaint(value: string): boolean {
  const s = value.trim().toLowerCase();
  return !s || s === "none" || s === "transparent" || s.startsWith("url(");
}

type ColorFn = (hex: string | null, raw: string) => string | null;

const PAINT_ATTR = /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const PAINT_STYLE = /(^|[\s;{"'])(fill|stroke|stop-color|flood-color|lighting-color)\s*:\s*([^;"'}]+)/gi;

/** Rewrite every paint value (attributes, style="" and <style> rules). Return null from `fn` to keep a value. */
export function transformColors(svg: string, fn: ColorFn): string {
  return svg
    .replace(PAINT_ATTR, (m, k: string, dq: string | undefined, sq: string | undefined) => {
      const raw = dq ?? sq ?? "";
      const out = fn(normalizeColor(raw), raw);
      return out == null ? m : `${k}="${out}"`;
    })
    .replace(PAINT_STYLE, (m, pre: string, k: string, raw: string) => {
      const out = fn(normalizeColor(raw), raw.trim());
      return out == null ? m : `${pre}${k}:${out}`;
    });
}

/** Unique paint colours (hex) used in an SVG, in document order. */
export function collectColors(svg: string): string[] {
  const seen: string[] = [];
  transformColors(svg, (hex) => {
    if (hex && !seen.includes(hex)) seen.push(hex);
    return null;
  });
  return seen;
}

/**
 * Recolour an SVG. With a mapping, only the listed colours change (keys are any
 * hex/rgb form). With a single colour every paint becomes that colour and the
 * root gains a `fill` so unpainted shapes (default black) follow too.
 */
export function recolorSvg(svg: string, mapping: Record<string, string> | string): string {
  if (typeof mapping === "string") {
    const color = mapping;
    const out = transformColors(svg, (_hex, raw) => (isNonPaint(raw) ? null : color));
    const attrs = svgRootAttrs(out);
    return attrs.fill ? out : setRootAttrs(out, { fill: color });
  }
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) {
    const nk = normalizeColor(k);
    if (nk && v && nk !== v.toLowerCase()) map[nk] = v;
  }
  if (!Object.keys(map).length) return svg;
  return transformColors(svg, (hex) => (hex && map[hex] ? map[hex] : null));
}

export function monochrome(svg: string, color: string): string {
  return recolorSvg(svg, color);
}

export function invert(svg: string): string {
  return transformColors(svg, (hex) => {
    if (!hex) return null;
    const n = parseInt(hex.slice(1), 16);
    const inv = 0xffffff - n;
    return `#${inv.toString(16).padStart(6, "0")}`;
  });
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Closest candidate by RGB distance (returns the candidate hex, or the input when no candidates). */
export function nearestColor(hex: string, candidates: string[]): string {
  const src = normalizeColor(hex);
  if (!src || !candidates.length) return hex;
  const [r, g, b] = hexToRgbTuple(src);
  let best = candidates[0];
  let bestD = Infinity;
  for (const c of candidates) {
    const n = normalizeColor(c);
    if (!n) continue;
    const [cr, cg, cb] = hexToRgbTuple(n);
    const d = (r - cr) ** 2 * 0.3 + (g - cg) ** 2 * 0.59 + (b - cb) ** 2 * 0.11;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// ── Geometry ───────────────────────────────────────────────────────────────

/**
 * Tighten the viewBox to the rendered content (plus padding in viewBox units).
 * Uses an offscreen inline render + getBBox; returns the input untouched on the server.
 */
export function fitViewBox(svg: string, padding = 0): string {
  if (typeof document === "undefined") return svg;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-100000px;top:0;width:1000px;height:1000px;overflow:hidden;visibility:hidden;pointer-events:none";
  host.innerHTML = sanitizeSvg(svg);
  document.body.appendChild(host);
  try {
    const el = host.querySelector("svg");
    if (!el) return svg;
    const bb = el.getBBox();
    if (!(bb.width > 0 && bb.height > 0)) return svg;
    const x = bb.x - padding;
    const y = bb.y - padding;
    const w = bb.width + padding * 2;
    const h = bb.height + padding * 2;
    return setRootAttrs(svg, { viewBox: `${r3(x)} ${r3(y)} ${r3(w)} ${r3(h)}`, width: r3(w), height: r3(h) });
  } catch {
    return svg;
  } finally {
    host.remove();
  }
}

export interface LockupOptions {
  mark: string;
  wordmark: string;
  layout: "horizontal" | "stacked";
  /** Gap as a fraction of the mark height (0.25 = quarter of the mark). */
  gap?: number;
  /** Cross-axis alignment: vertical for horizontal lockups, horizontal for stacked. */
  align?: "start" | "center" | "end";
  /** Wordmark height relative to the mark height. */
  wordmarkScale?: number;
}

/** Compose mark + wordmark into a single SVG with a correct viewBox. */
export function composeLockup(o: LockupOptions): string {
  const M = 100;
  const ms = svgSize(o.mark);
  const ws = svgSize(o.wordmark);
  const align = o.align ?? "center";
  const mw = (M * ms.width) / ms.height;
  const wh = M * (o.wordmarkScale ?? (o.layout === "horizontal" ? 0.5 : 0.32));
  const ww = (wh * ws.width) / ws.height;
  const gap = M * (o.gap ?? 0.25);
  const place = (total: number, size: number) => (align === "start" ? 0 : align === "end" ? total - size : (total - size) / 2);
  if (o.layout === "horizontal") {
    const W = mw + gap + ww;
    const H = Math.max(M, wh);
    const inner = embedSvg(o.mark, 0, place(H, M), mw, M) + embedSvg(o.wordmark, mw + gap, place(H, wh), ww, wh);
    return wrapSvg(W, H, inner);
  }
  const W = Math.max(mw, ww);
  const H = M + gap + wh;
  const inner = embedSvg(o.mark, place(W, mw), 0, mw, M) + embedSvg(o.wordmark, place(W, ww), M + gap, ww, wh);
  return wrapSvg(W, H, inner);
}

export interface TileOptions {
  size?: number;
  background: string;
  /** Corner radius as a fraction of size. */
  radius?: number;
  /** Padding as a fraction of size. */
  padding?: number;
}

/** The mark centred on a rounded colour tile (favicons, app icons, avatars). */
export function tileSvg(mark: string, opts: TileOptions): string {
  const size = opts.size ?? 256;
  const pad = size * (opts.padding ?? 0.18);
  const rx = size * (opts.radius ?? 0.22);
  const inner = `<rect width="${size}" height="${size}" rx="${r3(rx)}" fill="${opts.background}"/>` + embedSvg(mark, pad, pad, size - pad * 2, size - pad * 2);
  return wrapSvg(size, size, inner);
}

/** The logo on a solid background with padding (for PNG exports of light-on-dark variants). */
export function onBackgroundSvg(svg: string, background: string, paddingFraction = 0.1): string {
  const s = svgSize(svg);
  const pad = Math.max(s.width, s.height) * paddingFraction;
  const W = s.width + pad * 2;
  const H = s.height + pad * 2;
  return wrapSvg(W, H, `<rect width="${r3(W)}" height="${r3(H)}" fill="${background}"/>` + embedSvg(svg, pad, pad, s.width, s.height));
}

export interface ClearspaceOptions {
  /** Guide colour. */
  color?: string;
  /** The "x" unit as a fraction of the logo height. */
  unitFraction?: number;
  labels?: boolean;
}

/**
 * Draw the logo with its clearspace zone: a dashed exclusion box at
 * `multiplier × x` on every side, where x = a quarter of the logo height.
 */
export function clearspaceGuideSvg(logoSvg: string, multiplier: number, opts: ClearspaceOptions = {}): string {
  const color = opts.color ?? "#e0457b";
  const labels = opts.labels ?? true;
  const { width: w, height: h } = svgSize(logoSvg);
  const x = h * (opts.unitFraction ?? 0.25);
  const cs = Math.max(0, x * multiplier);
  const font = Math.max(6, x * 0.42);
  const margin = font * 1.8;
  const ox = margin + cs;
  const oy = margin + cs;
  const boxX = margin;
  const boxY = margin;
  const boxW = w + cs * 2;
  const boxH = h + cs * 2;
  const unitGap = x * 0.4;
  const W = boxX + boxW + unitGap + x + margin;
  const H = boxY + boxH + margin;
  const sw = Math.max(0.5, x * 0.03);
  const dash = `${r3(sw * 6)} ${r3(sw * 4)}`;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
  const label = `${fmt(multiplier)}x`;
  const parts: string[] = [];
  parts.push(`<rect x="${r3(boxX)}" y="${r3(boxY)}" width="${r3(boxW)}" height="${r3(boxH)}" fill="${color}" fill-opacity="0.05" stroke="${color}" stroke-width="${r3(sw)}" stroke-dasharray="${dash}"/>`);
  parts.push(`<rect x="${r3(ox)}" y="${r3(oy)}" width="${r3(w)}" height="${r3(h)}" fill="none" stroke="${color}" stroke-opacity="0.45" stroke-width="${r3(sw)}"/>`);
  parts.push(embedSvg(logoSvg, ox, oy, w, h));
  // x-unit swatch beside the box
  const ux = boxX + boxW + unitGap;
  parts.push(`<rect x="${r3(ux)}" y="${r3(oy)}" width="${r3(x)}" height="${r3(x)}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="${r3(sw)}"/>`);
  if (cs > 0) {
    // dimension ticks: top band and left band
    const tick = x * 0.18;
    const midX = ox + w / 2;
    parts.push(`<line x1="${r3(midX)}" y1="${r3(boxY)}" x2="${r3(midX)}" y2="${r3(oy)}" stroke="${color}" stroke-width="${r3(sw)}"/>`);
    parts.push(`<line x1="${r3(midX - tick)}" y1="${r3(boxY)}" x2="${r3(midX + tick)}" y2="${r3(boxY)}" stroke="${color}" stroke-width="${r3(sw)}"/>`);
    parts.push(`<line x1="${r3(midX - tick)}" y1="${r3(oy)}" x2="${r3(midX + tick)}" y2="${r3(oy)}" stroke="${color}" stroke-width="${r3(sw)}"/>`);
    const midY = oy + h / 2;
    parts.push(`<line x1="${r3(boxX)}" y1="${r3(midY)}" x2="${r3(ox)}" y2="${r3(midY)}" stroke="${color}" stroke-width="${r3(sw)}"/>`);
    parts.push(`<line x1="${r3(boxX)}" y1="${r3(midY - tick)}" x2="${r3(boxX)}" y2="${r3(midY + tick)}" stroke="${color}" stroke-width="${r3(sw)}"/>`);
    parts.push(`<line x1="${r3(ox)}" y1="${r3(midY - tick)}" x2="${r3(ox)}" y2="${r3(midY + tick)}" stroke="${color}" stroke-width="${r3(sw)}"/>`);
  }
  if (labels) {
    const fontAttrs = `font-family="Inter, system-ui, sans-serif" font-size="${r3(font)}" fill="${color}"`;
    parts.push(`<text x="${r3(ux + x / 2)}" y="${r3(oy + x / 2 + font * 0.35)}" text-anchor="middle" ${fontAttrs} font-weight="600">x</text>`);
    if (cs > 0) {
      parts.push(`<text x="${r3(ox + w / 2 + font * 0.4)}" y="${r3(boxY + cs / 2 + font * 0.35)}" ${fontAttrs}>${label}</text>`);
      parts.push(`<text x="${r3(boxX + cs / 2)}" y="${r3(oy + h / 2 - font * 0.5)}" text-anchor="middle" ${fontAttrs}>${label}</text>`);
    }
    parts.push(`<text x="${r3(boxX)}" y="${r3(boxY - font * 0.5)}" ${fontAttrs} font-size="${r3(font * 0.85)}">Clearspace = ${label} on every side · x = ¼ logo height</text>`);
  }
  return wrapSvg(W, H, parts.join(""));
}

/** Quick stats for the UI. */
export function svgStats(svg: string): { paths: number; shapes: number; bytes: number; colors: number } {
  const paths = (svg.match(/<path\b/gi) ?? []).length;
  const shapes = (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line|text)\b/gi) ?? []).length;
  return { paths, shapes, bytes: new TextEncoder().encode(svg).length, colors: collectColors(svg).length };
}

/**
 * Timeline: frame indexing + turning per-frame directives into an SVG string.
 *
 * `buildTimeline` is pure. `prepare` and `applyDirectivesToSvg` use the
 * browser DOM (DOMParser/XMLSerializer, and a hidden <svg> for path lengths),
 * so call them from handlers/effects only.
 */
import { clamp01, easeFromCss, type EasingFn } from "./easing";
import { emberAt, type FrameDirectives, type MotionContext, type MotionPreset, type PartDirectives } from "./presets";

const SVG_NS = "http://www.w3.org/2000/svg";
const GEOMETRY_TAGS = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const TEXT_TAGS = new Set(["text"]);
const NON_RENDER_TAGS = new Set(["defs", "style", "title", "desc", "metadata", "script", "symbol", "lineargradient", "radialgradient", "pattern", "clippath", "mask", "filter", "marker", "font", "font-face"]);

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface PreparedPart {
  index: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
}

export interface PreparedSvg extends ViewBox {
  /** The SVG with stable `data-ml` ids on shapes and `data-ml-part` on top-level children */
  svg: string;
  /** Path lengths in user units keyed by `data-ml` id */
  lengths: Record<string, number>;
  parts: PreparedPart[];
  partCount: number;
  shapeCount: number;
}

/** Reads viewBox (or width/height) including the origin. Defaults to 0 0 512 512. */
export function parseViewBox(svg: string): ViewBox {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n)) && vb[2] > 0 && vb[3] > 0) return { minX: vb[0], minY: vb[1], width: vb[2], height: vb[3] };
  const w = parseFloat(/<svg[^>]*\swidth\s*=\s*"([\d.]+)/i.exec(svg)?.[1] ?? "");
  const h = parseFloat(/<svg[^>]*\sheight\s*=\s*"([\d.]+)/i.exec(svg)?.[1] ?? "");
  if (w > 0 && h > 0) return { minX: 0, minY: 0, width: w, height: h };
  return { minX: 0, minY: 0, width: 512, height: 512 };
}

function parseSvg(svg: string): { doc: XMLDocument; root: SVGSVGElement } {
  if (typeof DOMParser === "undefined") throw new Error("SVG processing needs a browser DOM");
  const doc = new DOMParser().parseFromString(svg.trim(), "image/svg+xml");
  const root = doc.documentElement as unknown as SVGSVGElement | null;
  if (!root || root.localName !== "svg" || doc.querySelector("parsererror")) throw new Error("The logo is not a valid SVG document");
  return { doc, root };
}

/**
 * Prepares a logo SVG for animation: tags shapes and top-level parts with ids and measures
 * path lengths / part bounding boxes in a hidden, off-screen <svg>.
 */
export function prepare(svg: string): PreparedSvg {
  const { root } = parseSvg(svg);
  const box = parseViewBox(svg);
  root.setAttribute("viewBox", `${box.minX} ${box.minY} ${box.width} ${box.height}`);
  root.removeAttribute("width");
  root.removeAttribute("height");

  let shapeCount = 0;
  root.querySelectorAll("*").forEach((el) => {
    const tag = el.localName.toLowerCase();
    if (GEOMETRY_TAGS.has(tag) || TEXT_TAGS.has(tag)) el.setAttribute("data-ml", `s${shapeCount++}`);
  });
  let partCount = 0;
  for (const child of Array.from(root.children)) {
    if (!NON_RENDER_TAGS.has(child.localName.toLowerCase())) child.setAttribute("data-ml-part", String(partCount++));
  }

  const lengths: Record<string, number> = {};
  const parts: PreparedPart[] = [];
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-100000px;top:0;width:512px;height:512px;overflow:hidden;visibility:hidden;pointer-events:none;contain:strict";
  const clone = document.importNode(root, true);
  clone.setAttribute("width", "512");
  clone.setAttribute("height", "512");
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    clone.querySelectorAll("[data-ml]").forEach((el) => {
      const id = el.getAttribute("data-ml")!;
      let len = 0;
      try {
        if (typeof (el as SVGGeometryElement).getTotalLength === "function") len = (el as SVGGeometryElement).getTotalLength();
        else if (typeof (el as SVGTextContentElement).getComputedTextLength === "function") len = (el as SVGTextContentElement).getComputedTextLength() * 3.5;
      } catch {
        len = 0;
      }
      if (Number.isFinite(len) && len > 0) lengths[id] = len;
    });
    clone.querySelectorAll("[data-ml-part]").forEach((el) => {
      let bbox: PreparedPart["bbox"] = null;
      try {
        const b = (el as SVGGraphicsElement).getBBox();
        if (b.width > 0 || b.height > 0) bbox = { x: b.x, y: b.y, w: b.width, h: b.height };
      } catch {
        bbox = null;
      }
      parts.push({ index: Number(el.getAttribute("data-ml-part")), bbox });
    });
  } finally {
    host.remove();
  }
  parts.sort((a, b) => a.index - b.index);
  return { svg: new XMLSerializer().serializeToString(root), ...box, lengths, parts, partCount, shapeCount };
}

/* ────────────────────────────── timeline ────────────────────────────── */

export interface TimelineOptions {
  preset: MotionPreset;
  /** Animation length in seconds (hold excluded) */
  duration: number;
  /** Easing function or CSS timing string */
  easing: EasingFn | string;
  fps: number;
  /** Seconds to hold the final frame */
  hold?: number;
  /** Add the accent ember to presets that do not already have one */
  ember?: boolean;
  ctx?: Partial<Pick<MotionContext, "partCount" | "primary" | "accent">>;
}

export interface Timeline {
  preset: MotionPreset;
  fps: number;
  duration: number;
  hold: number;
  /** Total length in seconds including hold */
  total: number;
  frames: number;
  animFrames: number;
  holdFrames: number;
  ctx: MotionContext;
  /** Directives for a frame index (cached) */
  stateAt: (frameIndex: number) => FrameDirectives;
  /** Directives for a time in seconds (continuous, for previews) */
  stateAtTime: (seconds: number) => FrameDirectives;
  /** Time in seconds of a frame index */
  timeAt: (frameIndex: number) => number;
}

export function buildTimeline(o: TimelineOptions): Timeline {
  const ease = typeof o.easing === "string" ? easeFromCss(o.easing) : o.easing;
  const easingCss = typeof o.easing === "string" ? o.easing : "custom";
  const fps = Math.max(1, Math.round(o.fps));
  const duration = Math.max(0.1, o.duration);
  const hold = Math.max(0, o.hold ?? 0);
  const animFrames = Math.max(2, Math.round(duration * fps));
  const holdFrames = Math.round(hold * fps);
  const frames = animFrames + holdFrames;
  const ctx: MotionContext = {
    ease,
    easingCss,
    duration,
    partCount: Math.max(1, o.ctx?.partCount ?? 1),
    primary: o.ctx?.primary ?? "#111111",
    accent: o.ctx?.accent ?? o.ctx?.primary ?? "#111111",
  };
  const at = (t: number): FrameDirectives => {
    const d = o.preset.frame(clamp01(t), ctx);
    if (o.ember && !d.ember) return { ...d, ember: emberAt(clamp01(t), ctx) };
    return d;
  };
  const cache = new Map<number, FrameDirectives>();
  return {
    preset: o.preset,
    fps,
    duration,
    hold,
    total: frames / fps,
    frames,
    animFrames,
    holdFrames,
    ctx,
    stateAt: (i) => {
      const idx = Math.min(frames - 1, Math.max(0, Math.round(i)));
      let d = cache.get(idx);
      if (!d) {
        d = at(idx >= animFrames - 1 ? 1 : idx / (animFrames - 1));
        cache.set(idx, d);
      }
      return d;
    },
    stateAtTime: (s) => at(duration > 0 ? s / duration : 1),
    timeAt: (i) => i / fps,
  };
}

/* ─────────────────────── directives → SVG string ─────────────────────── */

export interface ApplyOptions {
  prepared?: PreparedSvg;
  primary?: string;
  accent?: string;
  /** Extra room around the viewBox (fraction of size) so blur/glow/ember are not clipped */
  margin?: number;
}

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

function styleFill(el: Element): string | null {
  const style = el.getAttribute("style");
  if (!style) return null;
  const m = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(style);
  return m ? m[1].trim() : null;
}

/** The colour a shape is painted with, walking up the tree like CSS inheritance would. */
function resolveFill(el: Element, fallback: string): string {
  let node: Element | null = el;
  while (node && node.localName !== "svg") {
    const f = styleFill(node) ?? node.getAttribute("fill");
    if (f && f !== "inherit") {
      if (f === "none") return fallback;
      if (f === "currentColor") {
        const c = node.closest("[color]")?.getAttribute("color");
        return c || fallback;
      }
      return f;
    }
    node = node.parentElement;
  }
  return fallback;
}

function isLineArt(el: Element): boolean {
  const stroke = el.getAttribute("stroke");
  if (!stroke || stroke === "none") return false;
  let node: Element | null = el;
  while (node && node.localName !== "svg") {
    const f = styleFill(node) ?? node.getAttribute("fill");
    if (f) return f === "none";
    node = node.parentElement;
  }
  return false;
}

function applyDraw(content: Element, draw: NonNullable<FrameDirectives["draw"]>, lengths: Record<string, number>, primary: string, width: number) {
  const shapes = Array.from(content.querySelectorAll("[data-ml]"));
  const n = shapes.length;
  if (!n) return;
  const stagger = Math.max(0, draw.stagger ?? 0.35);
  const strokeWidth = draw.strokeWidth ?? Math.max(1, width * 0.008);
  const fill = clamp01(draw.fill);
  shapes.forEach((el, i) => {
    const id = el.getAttribute("data-ml")!;
    const length = lengths[id] ?? width * 4;
    const local = n > 1 ? clamp01(clamp01(draw.progress) * (1 + stagger) - (i / (n - 1)) * stagger) : clamp01(draw.progress);
    const lineArt = isLineArt(el);
    el.setAttribute("stroke-dasharray", fmt(length));
    el.setAttribute("stroke-dashoffset", fmt(length * (1 - local)));
    if (!el.hasAttribute("stroke-linecap")) el.setAttribute("stroke-linecap", "round");
    if (!el.hasAttribute("stroke-linejoin")) el.setAttribute("stroke-linejoin", "round");
    if (!lineArt) {
      el.setAttribute("stroke", resolveFill(el, primary));
      el.setAttribute("stroke-width", fmt(strokeWidth));
      el.setAttribute("stroke-opacity", fmt(1 - fill));
      el.setAttribute("fill-opacity", fmt(fill));
    }
  });
}

function partTransform(pd: PartDirectives, cx: number, cy: number, w: number, h: number): string {
  const ops: string[] = [];
  if (pd.translate && (pd.translate.x || pd.translate.y)) ops.push(`translate(${fmt(pd.translate.x * w)} ${fmt(pd.translate.y * h)})`);
  if ((pd.scale !== undefined && pd.scale !== 1) || pd.rotate) {
    ops.push(`translate(${fmt(cx)} ${fmt(cy)})`);
    if (pd.rotate) ops.push(`rotate(${fmt(pd.rotate)})`);
    if (pd.scale !== undefined && pd.scale !== 1) ops.push(`scale(${fmt(pd.scale)})`);
    ops.push(`translate(${fmt(-cx)} ${fmt(-cy)})`);
  }
  return ops.join(" ");
}

/**
 * Applies frame directives to a (prepared) logo SVG and returns a new SVG string with an
 * expanded viewBox (`margin` on every side) so filters and overlays are not clipped.
 */
export function applyDirectivesToSvg(svg: string, d: FrameDirectives, opts: ApplyOptions = {}): string {
  const { doc, root } = parseSvg(svg);
  const box: ViewBox = opts.prepared ? { minX: opts.prepared.minX, minY: opts.prepared.minY, width: opts.prepared.width, height: opts.prepared.height } : parseViewBox(svg);
  const { minX, minY, width: W, height: H } = box;
  const margin = opts.margin ?? 0.5;
  const primary = opts.primary ?? "#111111";
  const accent = opts.accent ?? primary;
  const cx = minX + W / 2;
  const cy = minY + H / 2;
  const exp = { x: minX - W * margin, y: minY - H * margin, w: W * (1 + 2 * margin), h: H * (1 + 2 * margin) };
  const mk = (tag: string) => doc.createElementNS(SVG_NS, tag);

  // Move the original content into a group we can wrap.
  const content = mk("g");
  content.setAttribute("data-ml-content", "");
  while (root.firstChild) content.appendChild(root.firstChild);

  // Per-part directives (top-level children in document order).
  if (d.parts?.length) {
    const kids = Array.from(content.children).filter((el) => el.hasAttribute("data-ml-part"));
    for (const el of kids) {
      const i = Number(el.getAttribute("data-ml-part"));
      const pd = d.parts[i];
      if (!pd) continue;
      const bbox = opts.prepared?.parts.find((p) => p.index === i)?.bbox;
      const pcx = bbox ? bbox.x + bbox.w / 2 : cx;
      const pcy = bbox ? bbox.y + bbox.h / 2 : cy;
      const wrap = mk("g");
      const tf = partTransform(pd, pcx, pcy, W, H);
      if (tf) wrap.setAttribute("transform", tf);
      if (pd.opacity !== undefined && pd.opacity < 1) wrap.setAttribute("opacity", fmt(clamp01(pd.opacity)));
      content.insertBefore(wrap, el);
      wrap.appendChild(el);
    }
  }

  // Draw-on (skipped entirely once the reveal is complete so the original artwork is untouched).
  if (d.draw && !(d.draw.progress >= 1 && d.draw.fill >= 1)) applyDraw(content, d.draw, opts.prepared?.lengths ?? {}, primary, W);

  const defs = mk("defs");

  // Split-join: two clipped <use> copies of the content, offset in opposite directions.
  let inner: Element = content;
  if (d.split && Math.abs(d.split.offset) > 0.0005) {
    const src = mk("g");
    src.setAttribute("id", "ml-src");
    src.appendChild(content);
    defs.appendChild(src);
    const wrapper = mk("g");
    const horizontal = d.split.axis !== "y";
    for (const side of [0, 1] as const) {
      const cp = mk("clipPath");
      cp.setAttribute("id", `ml-split-${side}`);
      const r = mk("rect");
      if (horizontal) {
        r.setAttribute("x", fmt(side === 0 ? exp.x : cx));
        r.setAttribute("y", fmt(exp.y));
        r.setAttribute("width", fmt(side === 0 ? cx - exp.x : exp.x + exp.w - cx));
        r.setAttribute("height", fmt(exp.h));
      } else {
        r.setAttribute("x", fmt(exp.x));
        r.setAttribute("y", fmt(side === 0 ? exp.y : cy));
        r.setAttribute("width", fmt(exp.w));
        r.setAttribute("height", fmt(side === 0 ? cy - exp.y : exp.y + exp.h - cy));
      }
      cp.appendChild(r);
      defs.appendChild(cp);
      const g = mk("g");
      g.setAttribute("clip-path", `url(#ml-split-${side})`);
      const use = mk("use");
      use.setAttribute("href", "#ml-src");
      const sign = side === 0 ? -1 : 1;
      use.setAttribute("transform", horizontal ? `translate(${fmt(sign * d.split.offset * W)} 0)` : `translate(0 ${fmt(sign * d.split.offset * H)})`);
      g.appendChild(use);
      wrapper.appendChild(g);
    }
    inner = wrapper;
  }

  // Whole-logo transform + opacity.
  const tg = mk("g");
  const ops: string[] = [];
  const tx = d.translate?.x ?? 0;
  const ty = d.translate?.y ?? 0;
  const scale = d.scale ?? 1;
  const rotate = d.rotate ?? 0;
  if (tx || ty) ops.push(`translate(${fmt(tx * W)} ${fmt(ty * H)})`);
  if (scale !== 1 || rotate) {
    ops.push(`translate(${fmt(cx)} ${fmt(cy)})`);
    if (rotate) ops.push(`rotate(${fmt(rotate)})`);
    if (scale !== 1) ops.push(`scale(${fmt(scale)})`);
    ops.push(`translate(${fmt(-cx)} ${fmt(-cy)})`);
  }
  if (ops.length) tg.setAttribute("transform", ops.join(" "));
  if (d.opacity !== undefined && d.opacity < 1) tg.setAttribute("opacity", fmt(clamp01(d.opacity)));
  tg.appendChild(inner);
  let node: Element = tg;

  // Filters (blur inside, glow outside so the halo is not blurred twice).
  if (d.blur && d.blur > 0.0005) {
    const f = mk("filter");
    f.setAttribute("id", "ml-blur");
    f.setAttribute("x", "-50%");
    f.setAttribute("y", "-50%");
    f.setAttribute("width", "200%");
    f.setAttribute("height", "200%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const b = mk("feGaussianBlur");
    b.setAttribute("stdDeviation", fmt(d.blur * W));
    f.appendChild(b);
    defs.appendChild(f);
    const g = mk("g");
    g.setAttribute("filter", "url(#ml-blur)");
    g.appendChild(node);
    node = g;
  }
  if (d.glow && d.glow.opacity > 0.005 && d.glow.radius > 0) {
    const f = mk("filter");
    f.setAttribute("id", "ml-glow");
    f.setAttribute("x", "-100%");
    f.setAttribute("y", "-100%");
    f.setAttribute("width", "300%");
    f.setAttribute("height", "300%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const blur = mk("feGaussianBlur");
    blur.setAttribute("in", "SourceAlpha");
    blur.setAttribute("stdDeviation", fmt(d.glow.radius * W));
    blur.setAttribute("result", "b");
    const flood = mk("feFlood");
    flood.setAttribute("flood-color", d.glow.color ?? accent);
    flood.setAttribute("flood-opacity", fmt(clamp01(d.glow.opacity)));
    flood.setAttribute("result", "c");
    const comp = mk("feComposite");
    comp.setAttribute("in", "c");
    comp.setAttribute("in2", "b");
    comp.setAttribute("operator", "in");
    comp.setAttribute("result", "g");
    const merge = mk("feMerge");
    for (const input of ["g", "g", "SourceGraphic"]) {
      const n = mk("feMergeNode");
      n.setAttribute("in", input);
      merge.appendChild(n);
    }
    f.append(blur, flood, comp, merge);
    defs.appendChild(f);
    const g = mk("g");
    g.setAttribute("filter", "url(#ml-glow)");
    g.appendChild(node);
    node = g;
  }

  // Static clip / mask in canvas space (does not move with the transform).
  const outer = mk("g");
  if (d.clip) {
    const cp = mk("clipPath");
    cp.setAttribute("id", "ml-clip");
    const r = mk("rect");
    r.setAttribute("x", fmt(minX + d.clip.x * W));
    r.setAttribute("y", fmt(minY + d.clip.y * H));
    r.setAttribute("width", fmt(Math.max(0, d.clip.w) * W));
    r.setAttribute("height", fmt(Math.max(0, d.clip.h) * H));
    cp.appendChild(r);
    defs.appendChild(cp);
    outer.setAttribute("clip-path", "url(#ml-clip)");
  }
  if (d.iris) {
    const m = mk("mask");
    m.setAttribute("id", "ml-iris");
    m.setAttribute("maskUnits", "userSpaceOnUse");
    m.setAttribute("x", fmt(exp.x));
    m.setAttribute("y", fmt(exp.y));
    m.setAttribute("width", fmt(exp.w));
    m.setAttribute("height", fmt(exp.h));
    const bg = mk("rect");
    bg.setAttribute("x", fmt(exp.x));
    bg.setAttribute("y", fmt(exp.y));
    bg.setAttribute("width", fmt(exp.w));
    bg.setAttribute("height", fmt(exp.h));
    bg.setAttribute("fill", "black");
    const c = mk("circle");
    c.setAttribute("cx", fmt(minX + (d.iris.cx ?? 0.5) * W));
    c.setAttribute("cy", fmt(minY + (d.iris.cy ?? 0.5) * H));
    c.setAttribute("r", fmt(Math.max(0, d.iris.r) * (Math.hypot(W, H) / 2)));
    c.setAttribute("fill", "white");
    m.append(bg, c);
    defs.appendChild(m);
    outer.setAttribute("mask", "url(#ml-iris)");
  }
  outer.appendChild(node);

  root.appendChild(defs);
  root.appendChild(outer);

  // Accent ember overlay, drawn in front.
  if (d.ember && d.ember.opacity > 0.005 && d.ember.r > 0) {
    const color = d.ember.color ?? accent;
    const soft = clamp01(d.ember.soft ?? 0.4);
    const grad = mk("radialGradient");
    grad.setAttribute("id", "ml-ember");
    const stops: [number, number][] = [
      [0, 1],
      [Math.max(0, 1 - soft), 0.95],
      [1, 0],
    ];
    for (const [offset, opacity] of stops) {
      const s = mk("stop");
      s.setAttribute("offset", fmt(offset));
      s.setAttribute("stop-color", color);
      s.setAttribute("stop-opacity", fmt(opacity));
      grad.appendChild(s);
    }
    defs.appendChild(grad);
    const c = mk("circle");
    c.setAttribute("cx", fmt(minX + d.ember.x * W));
    c.setAttribute("cy", fmt(minY + d.ember.y * H));
    c.setAttribute("r", fmt(d.ember.r * W * (1 + soft)));
    c.setAttribute("fill", "url(#ml-ember)");
    c.setAttribute("opacity", fmt(clamp01(d.ember.opacity)));
    root.appendChild(c);
  }

  root.setAttribute("viewBox", `${fmt(exp.x)} ${fmt(exp.y)} ${fmt(exp.w)} ${fmt(exp.h)}`);
  root.setAttribute("overflow", "visible");
  root.removeAttribute("width");
  root.removeAttribute("height");
  return new XMLSerializer().serializeToString(root);
}

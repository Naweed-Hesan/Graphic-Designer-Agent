/**
 * Perspective helpers for procedural mockups: homographies, mesh warps
 * (affine-per-triangle), a tiny 3D projector and a cylinder mapping.
 * Pure canvas-2D; no React.
 */

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Corner order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];
/** Maps unit-square coordinates (u, v ∈ 0..1) to canvas space. */
export type SurfaceMap = (u: number, v: number) => Point;

export const pt = (x: number, y: number): Point => ({ x, y });

export function quadFromRect(r: Rect): Quad {
  return [pt(r.x, r.y), pt(r.x + r.w, r.y), pt(r.x + r.w, r.y + r.h), pt(r.x, r.y + r.h)];
}

export function quadBounds(q: Quad): Rect {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Projective map from the unit square onto `quad` (Heckbert's method). */
export function quadHomography(quad: Quad): SurfaceMap {
  const [p0, p1, p2, p3] = quad;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const det = dx1 * dy2 - dx2 * dy1 || 1e-9;
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

/** Sub-quad of a surface given a rect in unit coordinates. */
export function subQuad(map: SurfaceMap, r: Rect): Quad {
  return [map(r.x, r.y), map(r.x + r.w, r.y), map(r.x + r.w, r.y + r.h), map(r.x, r.y + r.h)];
}

export function quadPath(ctx: CanvasRenderingContext2D, q: Quad): void {
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  ctx.lineTo(q[1].x, q[1].y);
  ctx.lineTo(q[2].x, q[2].y);
  ctx.lineTo(q[3].x, q[3].y);
  ctx.closePath();
}

type Drawable = HTMLImageElement | HTMLCanvasElement;

function imageSize(img: Drawable): { w: number; h: number } {
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height };
  return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
}

/** Draws one source triangle of `img` into a destination triangle with an affine transform. */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: Drawable,
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
  expand: number,
): void {
  const ax = sx1 - sx0, ay = sy1 - sy0, bx = sx2 - sx0, by = sy2 - sy0;
  const det = ax * by - bx * ay;
  if (Math.abs(det) < 1e-9) return;
  const ux = dx1 - dx0, uy = dy1 - dy0, vx = dx2 - dx0, vy = dy2 - dy0;
  const m11 = (ux * by - vx * ay) / det;
  const m12 = (-ux * bx + vx * ax) / det;
  const m21 = (uy * by - vy * ay) / det;
  const m22 = (-uy * bx + vy * ax) / det;
  const e = dx0 - m11 * sx0 - m12 * sy0;
  const f = dy0 - m21 * sx0 - m22 * sy0;
  // Expand the clip triangle slightly away from its centroid to hide seams.
  const cx = (dx0 + dx1 + dx2) / 3;
  const cy = (dy0 + dy1 + dy2) / 3;
  const grow = (x: number, y: number): [number, number] => {
    const lx = x - cx, ly = y - cy;
    const len = Math.hypot(lx, ly) || 1;
    return [x + (lx / len) * expand, y + (ly / len) * expand];
  };
  const [p0x, p0y] = grow(dx0, dy0);
  const [p1x, p1y] = grow(dx1, dy1);
  const [p2x, p2y] = grow(dx2, dy2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0x, p0y);
  ctx.lineTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m11, m21, m12, m22, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export interface MeshOptions {
  cols?: number;
  rows?: number;
  /** Clip expansion in canvas units to hide triangle seams. */
  expand?: number;
  /** Optional source crop in unit coordinates of the image. */
  src?: Rect;
}

/** Warps an image through an arbitrary unit-square → canvas mapping. */
export function drawImageToMesh(ctx: CanvasRenderingContext2D, img: Drawable, map: SurfaceMap, opts: MeshOptions = {}): void {
  const { w: iw, h: ih } = imageSize(img);
  if (!iw || !ih) return;
  const cols = Math.max(1, Math.round(opts.cols ?? 12));
  const rows = Math.max(1, Math.round(opts.rows ?? 12));
  const expand = opts.expand ?? 0.6;
  const src = opts.src ?? { x: 0, y: 0, w: 1, h: 1 };
  const grid: Point[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: Point[] = [];
    for (let i = 0; i <= cols; i++) row.push(map(i / cols, j / rows));
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = (src.x + (src.w * i) / cols) * iw;
      const u1 = (src.x + (src.w * (i + 1)) / cols) * iw;
      const v0 = (src.y + (src.h * j) / rows) * ih;
      const v1 = (src.y + (src.h * (j + 1)) / rows) * ih;
      const m00 = grid[j][i], m10 = grid[j][i + 1], m11 = grid[j + 1][i + 1], m01 = grid[j + 1][i];
      drawTriangle(ctx, img, u0, v0, u1, v0, u1, v1, m00.x, m00.y, m10.x, m10.y, m11.x, m11.y, expand);
      drawTriangle(ctx, img, u0, v0, u1, v1, u0, v1, m00.x, m00.y, m11.x, m11.y, m01.x, m01.y, expand);
    }
  }
}

/** Draws an image into an arbitrary quadrilateral with correct perspective. */
export function drawImageToQuad(ctx: CanvasRenderingContext2D, img: Drawable, quad: Quad, opts: MeshOptions = {}): void {
  const b = quadBounds(quad);
  const auto = Math.max(4, Math.min(16, Math.round(Math.max(b.w, b.h) / 40)));
  drawImageToMesh(ctx, img, quadHomography(quad), { cols: auto, rows: auto, ...opts });
}

export type Align = "center" | "start" | "end";

/** The rect an image occupies when fitted inside `rect` (contain), with optional scale/offset (fractions of rect). */
export function containRect(iw: number, ih: number, rect: Rect, opts: { scale?: number; offset?: Point; alignX?: Align; alignY?: Align } = {}): Rect {
  const scale = opts.scale ?? 1;
  const s = Math.min(rect.w / iw, rect.h / ih) * scale;
  const w = iw * s;
  const h = ih * s;
  const ax = opts.alignX ?? "center";
  const ay = opts.alignY ?? "center";
  const x = ax === "start" ? rect.x : ax === "end" ? rect.x + rect.w - w : rect.x + (rect.w - w) / 2;
  const y = ay === "start" ? rect.y : ay === "end" ? rect.y + rect.h - h : rect.y + (rect.h - h) / 2;
  const ox = (opts.offset?.x ?? 0) * rect.w;
  const oy = (opts.offset?.y ?? 0) * rect.h;
  return { x: x + ox, y: y + oy, w, h };
}

/** Draws an image fitted inside a rect, preserving aspect. Returns the drawn rect. */
export function drawImageContain(ctx: CanvasRenderingContext2D, img: Drawable, rect: Rect, align: { x?: Align; y?: Align; scale?: number; offset?: Point } = {}): Rect {
  const { w: iw, h: ih } = imageSize(img);
  if (!iw || !ih) return rect;
  const r = containRect(iw, ih, rect, { scale: align.scale, offset: align.offset, alignX: align.x, alignY: align.y });
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return r;
}

/**
 * Draws an image fitted inside a rect *of a surface* (in unit coordinates of the surface, whose
 * physical aspect is `surfaceAspect` = width/height) and warps it through `map`.
 */
export function drawImageContainOnSurface(
  ctx: CanvasRenderingContext2D,
  img: Drawable,
  map: SurfaceMap,
  surfaceAspect: number,
  rect: Rect,
  opts: { scale?: number; offset?: Point; alignX?: Align; alignY?: Align; mesh?: MeshOptions } = {},
): void {
  const { w: iw, h: ih } = imageSize(img);
  if (!iw || !ih) return;
  // Work in a space where the surface is surfaceAspect × 1 so aspect is preserved.
  const phys = { x: rect.x * surfaceAspect, y: rect.y, w: rect.w * surfaceAspect, h: rect.h };
  const r = containRect(iw, ih, phys, opts);
  const unit = { x: r.x / surfaceAspect, y: r.y, w: r.w / surfaceAspect, h: r.h };
  const inner: SurfaceMap = (u, v) => map(unit.x + u * unit.w, unit.y + v * unit.h);
  const b = quadBounds(subQuad(map, unit));
  const auto = Math.max(4, Math.min(16, Math.round(Math.max(b.w, b.h) / 40)));
  drawImageToMesh(ctx, img, inner, { cols: auto, rows: auto, ...opts.mesh });
}

/* ────────────────────────── 3D projection ────────────────────────── */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Camera {
  /** Screen centre. */
  cx: number;
  cy: number;
  /** Focal length in canvas units; larger = flatter perspective. */
  focal: number;
  /** Camera distance from the scene origin. */
  distance: number;
  /** Scene rotation (radians) applied in order Z, X, Y. */
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  /** Uniform scale of the scene. */
  scale?: number;
}

export function rotate3(p: Vec3, rx = 0, ry = 0, rz = 0): Vec3 {
  let { x, y, z } = p;
  if (rz) {
    const c = Math.cos(rz), s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  if (rx) {
    const c = Math.cos(rx), s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  return { x, y, z };
}

/** Projects a scene point (y up, z toward the viewer) to the canvas. */
export function project(p: Vec3, cam: Camera): Point {
  const s = cam.scale ?? 1;
  const r = rotate3({ x: p.x * s, y: p.y * s, z: p.z * s }, cam.rotX, cam.rotY, cam.rotZ);
  const depth = cam.distance - r.z;
  const k = cam.focal / Math.max(1e-3, depth);
  return { x: cam.cx + r.x * k, y: cam.cy - r.y * k };
}

/** Projects four scene points to a quad (same corner order). */
export function projectQuad(pts: [Vec3, Vec3, Vec3, Vec3], cam: Camera): Quad {
  return [project(pts[0], cam), project(pts[1], cam), project(pts[2], cam), project(pts[3], cam)];
}

/** Signed area; positive when the quad winds clockwise on screen (i.e. visible for our face convention). */
export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i], n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return a / 2;
}

/* ────────────────────────── cylinder mapping ────────────────────────── */

export interface CylinderSpec {
  /** Screen x of the axis. */
  cx: number;
  /** Screen y of the *front* rim point at the top and bottom of the mapped band. */
  top: number;
  bottom: number;
  /** Radii at top and bottom (a cone when they differ). */
  rTop: number;
  rBottom: number;
  /** Ellipse squash (minor/major) of the rims as seen from the camera; 0 = straight-on. */
  squash: number;
  /** Angular extent of the mapped band, radians, centred on `angleCenter`. */
  angle: number;
  angleCenter?: number;
}

/** Maps the unit square onto a band of a vertical cylinder/cone. */
export function cylinderMap(c: CylinderSpec): SurfaceMap {
  const a0 = (c.angleCenter ?? 0) - c.angle / 2;
  return (u, v) => {
    const th = a0 + u * c.angle;
    const r = c.rTop + (c.rBottom - c.rTop) * v;
    const y0 = c.top + (c.bottom - c.top) * v;
    return { x: c.cx + r * Math.sin(th), y: y0 - r * c.squash * (1 - Math.cos(th)) };
  };
}

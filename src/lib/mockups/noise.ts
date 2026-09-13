/** Cached grain / paper textures for procedural mockups (browser only). */

/** Deterministic PRNG so textures do not shimmer between renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * A tile of monochrome grain. `alpha` is the maximum per-pixel opacity (0–1).
 * The tile is cached; draw it with `ctx.createPattern` to cover any area.
 */
export function grain(width = 256, height = 256, alpha = 0.08, seed = 7): HTMLCanvasElement {
  const key = `g:${width}x${height}:${alpha.toFixed(3)}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(width, height);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(c.width, c.height);
  const rnd = mulberry32(seed);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = rnd() < 0.5 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = Math.round(255 * alpha * rnd());
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/**
 * Soft paper texture: low-frequency mottling (blurred noise) plus fine fibre grain.
 * Returns a tile intended for `createPattern(..., "repeat")` and blending with
 * "multiply" / "soft-light" at low alpha.
 */
export function paperTexture(size = 512, seed = 11): HTMLCanvasElement {
  const key = `p:${size}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  // Low-frequency mottling: draw a tiny noise tile scaled up with smoothing.
  const small = makeCanvas(size / 16, size / 16);
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(small.width, small.height);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.round(rnd() * 40);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = 0.6;
  ctx.drawImage(small, 0, 0, size, size);
  ctx.globalAlpha = 1;
  // Fine fibre grain.
  const g = grain(size, size, 0.22, seed + 1);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(g, 0, 0);
  ctx.globalAlpha = 1;
  cache.set(key, c);
  return c;
}

/** Fills a rect with grain using overlay blending. `intensity` 0–1. */
export function applyGrain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity: number, seed = 7): void {
  if (intensity <= 0) return;
  const tile = grain(256, 256, Math.min(1, 0.45 * intensity), seed);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Multiplies a paper texture over a rect (for card stock, posters, envelopes). */
export function applyPaper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity = 0.35, seed = 11): void {
  if (intensity <= 0) return;
  const tile = paperTexture(512, seed);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = Math.min(1, intensity);
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Tiny woven-fabric tile (warp/weft lines) for canvas, cotton and lanyards. */
export function weaveTexture(size = 6, seed = 5): HTMLCanvasElement {
  const key = `w:${size}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(size * 4, size * 4);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, c.width, c.height);
  const rnd = mulberry32(seed);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const over = (x + y) % 2 === 0;
      ctx.fillStyle = over ? `rgba(255,255,255,${0.18 + rnd() * 0.12})` : `rgba(0,0,0,${0.14 + rnd() * 0.12})`;
      ctx.fillRect(x * size, y * size, size, size);
      ctx.fillStyle = over ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.10)";
      if (over) ctx.fillRect(x * size, y * size + size - 1, size, 1);
      else ctx.fillRect(x * size + size - 1, y * size, 1, size);
    }
  }
  cache.set(key, c);
  return c;
}

/** Overlays the weave over a rect (call inside a clip). */
export function applyWeave(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity = 0.5): void {
  if (intensity <= 0) return;
  const pattern = ctx.createPattern(weaveTexture(), "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(1, intensity);
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

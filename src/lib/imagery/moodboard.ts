/**
 * Moodboard composer: a masonry grid (equal columns, preserved aspect) with an
 * optional title, rendered to a canvas. `layoutMoodboard` is pure so it can be
 * unit-tested without a DOM; `composeMoodboard` draws it.
 */

export interface MoodboardOptions {
  /** Output width in pixels */
  width: number;
  columns: number;
  gap: number;
  /** Any CSS colour */
  background: string;
  title?: string;
  subtitle?: string;
  /** CSS font-family stack for the title, e.g. `"Fraunces", serif` */
  font?: string;
  titleColor?: string;
  /** Outer padding; defaults to 4% of width */
  padding?: number;
  /** Tile corner radius in px */
  radius?: number;
}

export interface MoodboardTile {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MoodboardLayout {
  width: number;
  height: number;
  padding: number;
  titleSize: number;
  contentTop: number;
  tiles: MoodboardTile[];
}

export function layoutMoodboard(sizes: { width: number; height: number }[], opts: MoodboardOptions): MoodboardLayout {
  const width = Math.max(64, Math.round(opts.width));
  const columns = Math.max(1, Math.round(opts.columns));
  const gap = Math.max(0, opts.gap);
  const padding = Math.max(0, Math.round(opts.padding ?? width * 0.04));
  const titleSize = Math.round(width * 0.04);
  const titleBlock = opts.title ? titleSize * (opts.subtitle ? 2.4 : 1.3) + gap : 0;
  const contentTop = padding + titleBlock;
  const colW = (width - padding * 2 - gap * (columns - 1)) / columns;
  const heights = new Array<number>(columns).fill(contentTop);

  const tiles = sizes.map((s, index) => {
    let col = 0;
    for (let c = 1; c < columns; c++) if (heights[c] < heights[col] - 0.5) col = c;
    const h = s.width > 0 && s.height > 0 ? colW * (s.height / s.width) : colW;
    const tile: MoodboardTile = { index, x: padding + col * (colW + gap), y: heights[col], width: colW, height: h };
    heights[col] += h + gap;
    return tile;
  });

  const bottom = sizes.length ? Math.max(...heights) - gap : contentTop;
  return { width, height: Math.max(1, Math.round(bottom + padding)), padding, titleSize, contentTop, tiles };
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Composes loaded images into a moodboard canvas. Images must be decoded (loaded) already. */
export function composeMoodboard(images: HTMLImageElement[], opts: MoodboardOptions): HTMLCanvasElement {
  const sizes = images.map((i) => ({ width: i.naturalWidth || i.width, height: i.naturalHeight || i.height }));
  const layout = layoutMoodboard(sizes, opts);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (opts.title) {
    const font = opts.font ?? "serif";
    ctx.fillStyle = opts.titleColor ?? "#000";
    ctx.textBaseline = "alphabetic";
    ctx.font = `500 ${layout.titleSize}px ${font}`;
    ctx.fillText(opts.title, layout.padding, layout.padding + layout.titleSize * 0.95, layout.width - layout.padding * 2);
    if (opts.subtitle) {
      ctx.globalAlpha = 0.6;
      ctx.font = `400 ${Math.round(layout.titleSize * 0.42)}px ${font}`;
      ctx.fillText(opts.subtitle, layout.padding, layout.padding + layout.titleSize * 1.85, layout.width - layout.padding * 2);
      ctx.globalAlpha = 1;
    }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const radius = opts.radius ?? 0;
  for (const tile of layout.tiles) {
    const img = images[tile.index];
    const x = Math.round(tile.x);
    const y = Math.round(tile.y);
    const w = Math.round(tile.width);
    const h = Math.round(tile.height);
    ctx.save();
    if (radius > 0) {
      roundedRectPath(ctx, x, y, w, h, radius);
      ctx.clip();
    }
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }
  return canvas;
}

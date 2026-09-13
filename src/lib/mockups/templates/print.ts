/** Print: poster, lanyard badge, sticker sheet. */
import { alpha, darken, isDark, mix } from "../color";
import { backdrop, brandSurface, domainOf, drawFace, drawLogo, drawText, fillRoundRect, fitFontSize, font, inkOn, lightSurface, mutedInkOn, objectShadows, paperRect, pickLogo, quadShadow, rect, roundRectPath, shadowedFill, wrapText, type Ctx } from "../draw";
import { mulberry32 } from "../noise";
import type { Point, Quad } from "../perspective";
import type { MockupTemplate } from "../types";

function rotatedQuad(cx: number, cy: number, w: number, h: number, angle: number): Quad {
  const c = Math.cos(angle), s = Math.sin(angle);
  const p = (x: number, y: number): Point => ({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  return [p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)];
}

export const poster: MockupTemplate = {
  id: "poster",
  name: "Poster",
  category: "print",
  size: { width: 900, height: 1200 },
  description: "A-series poster on a wall: big display typography, mark in the corner.",
  featured: 12,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H, { vignette: 1.1 });
    const c = scene.colors;
    const dark = scene.options.theme === "dark";
    const paper = dark ? brandSurface(scene) : lightSurface(scene);
    const ink = dark ? (isDark(paper) ? "#ffffff" : "#111111") : c.primary;
    const inkText = dark ? (isDark(paper) ? "#ffffff" : "#111111") : inkOn(scene, paper);
    const pw = 660, ph = Math.round(pw * 1.4142);
    const px = (W - pw) / 2, py = 116;
    shadowedFill(ctx, () => { ctx.beginPath(); ctx.rect(px, py, pw, ph); }, paper, objectShadows(ph * 0.5, 0.9, { x: 0.1, y: 1 }));
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    paperRect(ctx, scene, px, py, pw, ph, 0.7);
    // Graphic: big accent disc, offset ring.
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(px + pw - 40, py + 250, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark ? alpha("#ffffff", 0.6) : alpha(c.secondary, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px + pw - 180, py + 340, 260, 0, Math.PI * 2);
    ctx.stroke();
    // Mark + edition line.
    const mark = pickLogo(scene, paper, { prefer: "mark", force: "mark" });
    drawLogo(ctx, scene, mark, rect(px + 54, py + 54, 84, 84), { alignX: "start", alignY: "start" });
    drawText(ctx, "EDITION 01", px + pw - 54, py + 92, { font: font(600, 12, scene.fonts.body), color: alpha(inkText, 0.7), align: "right", letterSpacing: 3 });
    // Headline.
    const headline = scene.options.showTagline && scene.text.tagline ? scene.text.tagline : scene.text.name;
    const maxW = pw - 108;
    const longest = headline.split(" ").reduce((a, b) => (b.length > a.length ? b : a), "");
    const size = fitFontSize(ctx, longest, scene.fonts.display, 600, maxW, 112, 40, -0.02);
    const f = font(600, size, scene.fonts.display);
    const lines = wrapText(ctx, headline, f, maxW, 4);
    const lh = size * 1.0;
    let yy = py + ph - 250 - (lines.length - 1) * lh;
    for (const l of lines) {
      drawText(ctx, l, px + 54, yy, { font: f, color: ink, letterSpacing: -size * 0.02 });
      yy += lh;
    }
    // Footer.
    ctx.fillStyle = alpha(inkText, 0.35);
    ctx.fillRect(px + 54, py + ph - 150, pw - 108, 1.5);
    drawText(ctx, scene.text.name.toUpperCase(), px + 54, py + ph - 108, { font: font(600, 13, scene.fonts.body), color: inkText, letterSpacing: 3 });
    drawText(ctx, domainOf(scene), px + pw - 54, py + ph - 108, { font: font(400, 13, scene.fonts.body), color: alpha(inkText, 0.7), align: "right", letterSpacing: 1 });
    const sub = (scene.text.positioning || "").split(/(?<=[.!?])\s/)[0];
    if (sub) drawText(ctx, sub, px + 54, py + ph - 74, { font: font(400, 13, scene.fonts.display, true), color: alpha(inkText, 0.7), maxWidth: pw - 108 });
    ctx.restore();
  },
};

function qrBlock(ctx: Ctx, x: number, y: number, s: number, color: string, seed = 9): void {
  const n = 21;
  const cell = s / n;
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  const finder = (fx: number, fy: number) => {
    ctx.fillRect(fx, fy, cell * 7, cell * 7);
    ctx.clearRect(fx + cell, fy + cell, cell * 5, cell * 5);
    ctx.fillRect(fx + cell * 2, fy + cell * 2, cell * 3, cell * 3);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const inFinder = (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9);
      if (!inFinder && rnd() > 0.55) ctx.fillRect(x + i * cell, y + j * cell, cell + 0.3, cell + 0.3);
    }
  }
  ctx.save();
  ctx.fillStyle = color;
  finder(x, y);
  finder(x + (n - 7) * cell, y);
  finder(x, y + (n - 7) * cell);
  ctx.restore();
}

export const lanyardBadge: MockupTemplate = {
  id: "lanyard-badge",
  name: "Lanyard & badge",
  category: "print",
  size: { width: 1200, height: 900 },
  description: "Event badge on a printed lanyard with a metal clip.",
  featured: 13,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const c = scene.colors;
    const brand = brandSurface(scene);
    const strapInk = isDark(brand) ? "#ffffff" : "#111111";
    const body = scene.fonts.body;
    // Straps.
    const straps: [Point, Point][] = [
      [{ x: 470, y: -40 }, { x: 588, y: 262 }],
      [{ x: 612, y: 262 }, { x: 730, y: -40 }],
    ];
    for (const [a, b] of straps) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const w = 36;
      // Face x runs a → b; face y runs along the normal so the print is not mirrored.
      const q: Quad = [
        { x: a.x - nx * (w / 2), y: a.y - ny * (w / 2) },
        { x: b.x - nx * (w / 2), y: b.y - ny * (w / 2) },
        { x: b.x + nx * (w / 2), y: b.y + ny * (w / 2) },
        { x: a.x + nx * (w / 2), y: a.y + ny * (w / 2) },
      ];
      quadShadow(ctx, q, [{ blur: 18, y: 8, color: "rgba(0,0,0,0.3)" }], darken(brand, 0.3));
      drawFace(ctx, scene, len, w, q, (f, fw, fh) => {
        f.fillStyle = brand;
        f.fillRect(0, 0, fw, fh);
        f.fillStyle = alpha(strapInk, 0.18);
        f.fillRect(0, 3, fw, 1);
        f.fillRect(0, fh - 4, fw, 1);
        const label = `${scene.text.name.toUpperCase()}   ·   `;
        f.font = font(700, 13, body);
        let x = -20;
        const step = Math.max(80, f.measureText(label).width);
        while (x < fw) {
          drawText(f, label, x, fh / 2 + 5, { font: font(700, 13, body), color: alpha(strapInk, 0.9), letterSpacing: 2.5 });
          x += step + 30;
        }
      });
    }
    // Clip.
    const clipG = ctx.createLinearGradient(570, 250, 630, 300);
    clipG.addColorStop(0, "#e8e9ec");
    clipG.addColorStop(0.5, "#a9adb5");
    clipG.addColorStop(1, "#d6d8dc");
    shadowedFill(ctx, () => roundRectPath(ctx, 568, 248, 64, 34, 8), clipG, [{ blur: 10, y: 4, color: "rgba(0,0,0,0.35)" }]);
    ctx.fillStyle = "#6f737a";
    ctx.fillRect(576, 262, 48, 3);

    // Badge (slightly rotated).
    const bw = 400, bh = 540;
    const q = rotatedQuad(600, 300 + bh / 2 + 10, bw, bh, -0.03);
    const paper = lightSurface(scene);
    const ink = inkOn(scene, paper);
    const muted = mutedInkOn(scene, paper);
    quadShadow(ctx, q, objectShadows(bh * 0.6, 1, { x: 0.2, y: 1 }), darken(paper, 0.15));
    drawFace(ctx, scene, 800, 1080, q, (f, fw, fh) => {
      f.fillStyle = paper;
      f.fillRect(0, 0, fw, fh);
      paperRect(f, scene, 0, 0, fw, fh, 0.6);
      // Brand band.
      f.fillStyle = brand;
      f.fillRect(0, 0, fw, 330);
      const logo = pickLogo(scene, brand, { prefer: "primary" });
      drawLogo(f, scene, logo, rect(fw * 0.2, 90, fw * 0.6, 180), { scale: 0.95 });
      // Slot hole.
      f.save();
      f.globalCompositeOperation = "destination-out";
      roundRectPath(f, fw / 2 - 60, 30, 120, 22, 11);
      f.fill();
      f.restore();
      // Person.
      drawText(f, "Alex Morgan", fw / 2, 470, { font: font(600, 56, scene.fonts.display), color: ink, align: "center", maxWidth: fw - 100 });
      drawText(f, "Head of Design", fw / 2, 520, { font: font(400, 24, body), color: muted, align: "center" });
      drawText(f, scene.text.name, fw / 2, 560, { font: font(600, 20, body), color: ink, align: "center", maxWidth: fw - 120 });
      // Access tag.
      const tag = c.accent;
      fillRoundRect(f, fw / 2 - 90, 620, 180, 52, 26, tag);
      drawText(f, "ALL AREAS", fw / 2, 654, { font: font(700, 18, body), color: isDark(tag) ? "#ffffff" : "#111111", align: "center", letterSpacing: 3 });
      // Footer: QR + event details.
      qrBlock(f, 70, fh - 250, 170, ink, 7);
      drawText(f, "STAFF", fw - 70, fh - 220, { font: font(700, 30, body), color: ink, align: "right", letterSpacing: 4 });
      drawText(f, "Summer showcase", fw - 70, fh - 180, { font: font(400, 20, body), color: muted, align: "right" });
      drawText(f, domainOf(scene), fw - 70, fh - 148, { font: font(400, 18, body), color: muted, align: "right" });
      drawText(f, "No. 0417", fw - 70, fh - 92, { font: font(500, 16, body), color: alpha(ink, 0.5), align: "right", letterSpacing: 2 });
    });
    // Ring through the slot.
    ctx.save();
    ctx.strokeStyle = "#b8bcc3";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(600, 296, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(600, 296, 16, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();
  },
};

export const stickerSheet: MockupTemplate = {
  id: "sticker-sheet",
  name: "Sticker sheet",
  category: "print",
  size: { width: 1200, height: 900 },
  description: "Die-cut stickers with the mark in every colour mode.",
  featured: 14,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const c = scene.colors;
    const sheetW = 880, sheetH = 640;
    const q = rotatedQuad(W / 2, H / 2 + 10, sheetW, sheetH, -0.035);
    const paper = lightSurface(scene);
    quadShadow(ctx, q, objectShadows(sheetH * 0.5, 0.9, { x: 0.1, y: 1 }), darken(paper, 0.15));
    drawFace(ctx, scene, sheetW, sheetH, q, (f, fw, fh) => {
      f.fillStyle = paper;
      f.fillRect(0, 0, fw, fh);
      paperRect(f, scene, 0, 0, fw, fh, 0.5);
      const r = 112;
      const fills = [brandSurface(scene), "#ffffff", c.accent, isDark(c.secondary) ? c.secondary : darken(c.secondary, 0.3), mix(c.neutral, "#ffffff", 0.15), c.background];
      const cols = [150, 440, 730];
      const rows = [190, 450];
      let n = 0;
      for (const cy of rows) {
        for (const cx of cols) {
          const i = n++;
          const fill = fills[i];
          const lifted = i === 3;
          const pill = i === 5;
          // Die-cut line.
          f.save();
          f.strokeStyle = alpha("#000000", 0.16);
          f.lineWidth = 1;
          f.setLineDash([3, 4]);
          f.beginPath();
          if (pill) roundRectPath(f, cx - 150, cy - 70, 300, 140, 70);
          else f.arc(cx, cy, r + 12, 0, Math.PI * 2);
          f.stroke();
          f.restore();
          // Sticker with white backing.
          const path = () => {
            f.beginPath();
            if (pill) roundRectPath(f, cx - 140, cy - 60, 280, 120, 60);
            else f.arc(cx, cy, r, 0, Math.PI * 2);
          };
          shadowedFill(f, path, "#ffffff", lifted ? [{ blur: 22, x: 6, y: 14, color: "rgba(0,0,0,0.3)" }, { blur: 4, y: 2, color: "rgba(0,0,0,0.15)" }] : [{ blur: 3, y: 1.5, color: "rgba(0,0,0,0.2)" }]);
          f.save();
          f.beginPath();
          if (pill) roundRectPath(f, cx - 134, cy - 54, 268, 108, 54);
          else f.arc(cx, cy, r - 6, 0, Math.PI * 2);
          f.clip();
          f.fillStyle = fill;
          f.fillRect(cx - 150, cy - 150, 300, 300);
          if (pill) {
            const wm = pickLogo(scene, fill, { prefer: "wordmark", force: "wordmark" });
            drawLogo(f, scene, wm, rect(cx - 110, cy - 36, 220, 72));
          } else if (i === 1) {
            drawLogo(f, scene, pickLogo(scene, "#ffffff", { prefer: "mark", force: "mark" }), rect(cx - 62, cy - 62, 124, 124));
          } else if (i === 4) {
            const mark = pickLogo(scene, fill, { prefer: "mark", force: "mark" });
            drawLogo(f, scene, mark, rect(cx - 48, cy - 70, 96, 96));
            const ink = isDark(fill) ? "#ffffff" : "#111111";
            drawText(f, scene.text.name.toUpperCase(), cx, cy + 66, { font: font(700, 13, scene.fonts.body), color: ink, align: "center", letterSpacing: 2.5, maxWidth: 170 });
          } else {
            const mark = pickLogo(scene, fill, { prefer: "mark", force: "mark" });
            drawLogo(f, scene, mark, rect(cx - 60, cy - 60, 120, 120));
            if (i === 2 || i === 3) {
              f.strokeStyle = alpha(isDark(fill) ? "#ffffff" : "#000000", 0.45);
              f.lineWidth = 2;
              f.beginPath();
              f.arc(cx, cy, r - 18, 0, Math.PI * 2);
              f.stroke();
            }
          }
          // Gloss.
          const g = f.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r);
          g.addColorStop(0, "rgba(255,255,255,0.22)");
          g.addColorStop(0.5, "rgba(255,255,255,0)");
          f.fillStyle = g;
          f.fillRect(cx - 150, cy - 150, 300, 300);
          f.restore();
        }
      }
      drawText(f, `${scene.text.name} — sticker sheet A`, 40, fh - 26, { font: font(500, 12, scene.fonts.body), color: alpha("#000000", 0.4), letterSpacing: 1 });
      drawText(f, "Ø 60 mm · vinyl · matte", fw - 40, fh - 26, { font: font(500, 12, scene.fonts.body), color: alpha("#000000", 0.4), align: "right", letterSpacing: 1 });
    });
  },
};

export const PRINT: MockupTemplate[] = [poster, stickerSheet, lanyardBadge];

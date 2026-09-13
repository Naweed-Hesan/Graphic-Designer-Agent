/** Stationery: business cards, letterhead + envelope. */
import { alpha, darken, isDark, mix } from "../color";
import { backdropWithTable, brandSurface, domainOf, drawFace, drawLogo, drawText, fillRoundRect, font, greekLines, inkOn, lightSurface, mutedInkOn, objectShadows, paperRect, pickLogo, quadShadow, rect, shadeQuad, tableQuad, type Ctx } from "../draw";
import { quadHomography, type Camera, type Quad } from "../perspective";
import type { MockupScene, MockupTemplate } from "../types";

/** Draws a card face with thickness and a soft shadow, then a light-response gradient. */
function card(ctx: Ctx, scene: MockupScene, cam: Camera, cx: number, cy: number, w: number, h: number, angle: number, z: number, faceW: number, faceH: number, draw: (f: Ctx, w: number, h: number) => void, edge: string, strength = 1): Quad {
  const base = tableQuad(cam, cx, cy, w, h, angle, z);
  const top = tableQuad(cam, cx, cy, w, h, angle, z + 3);
  quadShadow(ctx, base, objectShadows(h * 0.8, strength, { x: 0.35, y: 1 }), edge);
  drawFace(ctx, scene, faceW, faceH, top, draw);
  const m = quadHomography(top);
  const a = m(0, 0), b = m(1, 1);
  shadeQuad(ctx, top, (() => {
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, "rgba(255,255,255,0.16)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.10)");
    return g;
  })());
  return top;
}

export const businessCard: MockupTemplate = {
  id: "business-card",
  name: "Business cards",
  category: "stationery",
  size: { width: 1200, height: 900 },
  description: "Front and back on a tabletop, 85 × 55 mm, soft daylight.",
  featured: 1,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdropWithTable(ctx, scene, W, H, 0.34);
    const cam: Camera = { cx: W / 2, cy: H * 0.55, focal: 1500, distance: 1500, rotX: -0.98 };
    const cw = 372, ch = 240;
    const paper = lightSurface(scene);
    const brand = brandSurface(scene);
    const ink = inkOn(scene, paper);
    const muted = mutedInkOn(scene, paper);
    const edge = darken(paper, 0.18);

    // Back of card (brand colour), upper right, slightly turned.
    card(ctx, scene, cam, 120, 60, cw, ch, 0.34, 0, 850, 550, (f, w, h) => {
      f.fillStyle = brand;
      f.fillRect(0, 0, w, h);
      const logo = pickLogo(scene, brand, { prefer: "mark" });
      drawLogo(f, scene, logo, rect(w * 0.3, h * 0.2, w * 0.4, h * 0.46), { scale: 0.9 });
      if (scene.options.showTagline && scene.text.tagline) {
        const size = 22;
        drawText(f, scene.text.tagline, w / 2, h * 0.82, { font: font(400, size, scene.fonts.body), color: alpha(isDark(brand) ? "#ffffff" : "#000000", 0.78), align: "center" });
      }
      f.save();
      f.globalCompositeOperation = "soft-light";
      f.fillStyle = alpha("#ffffff", 0.08);
      f.fillRect(0, 0, w, h);
      f.restore();
    }, darken(brand, 0.35), 1);

    // Front of card (paper), lower left, on top.
    card(ctx, scene, cam, -120, -140, cw, ch, -0.12, 6, 850, 550, (f, w, h) => {
      f.fillStyle = paper;
      f.fillRect(0, 0, w, h);
      paperRect(f, scene, 0, 0, w, h, 0.9);
      const logo = pickLogo(scene, paper, { prefer: "primary" });
      drawLogo(f, scene, logo, rect(w * 0.16, h * 0.14, w * 0.68, h * 0.42), { scale: 0.9 });
      // Rule + contact row.
      f.fillStyle = alpha(ink, 0.14);
      f.fillRect(w * 0.08, h * 0.7, w * 0.84, 1.5);
      drawText(f, scene.text.name, w * 0.08, h * 0.82, { font: font(600, 21, scene.fonts.body), color: ink });
      drawText(f, domainOf(scene), w * 0.92, h * 0.82, { font: font(400, 18, scene.fonts.body), color: muted, align: "right" });
      drawText(f, `hello@${domainOf(scene)}`, w * 0.08, h * 0.9, { font: font(400, 16, scene.fonts.body), color: muted });
      drawText(f, "+1 (000) 000 0000", w * 0.92, h * 0.9, { font: font(400, 16, scene.fonts.body), color: muted, align: "right" });
    }, edge, 1.15);
  },
};

export const letterhead: MockupTemplate = {
  id: "letterhead",
  name: "Letterhead & envelope",
  category: "stationery",
  size: { width: 1200, height: 900 },
  description: "A4 letterhead with a DL envelope resting on the corner.",
  featured: 8,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdropWithTable(ctx, scene, W, H, 0.2);
    const cam: Camera = { cx: W / 2, cy: H * 0.52, focal: 1700, distance: 1700, rotX: -0.62 };
    const paper = lightSurface(scene);
    const brand = brandSurface(scene);
    const ink = inkOn(scene, paper);
    const muted = mutedInkOn(scene, paper);
    const body = scene.fonts.body;

    // A4 sheet.
    const sw = 470, sh = 664;
    card(ctx, scene, cam, -130, 40, sw, sh, -0.05, 0, 840, 1188, (f, w, h) => {
      f.fillStyle = paper;
      f.fillRect(0, 0, w, h);
      paperRect(f, scene, 0, 0, w, h, 0.7);
      const m = 72;
      const logo = pickLogo(scene, paper, { prefer: "primary" });
      drawLogo(f, scene, logo, rect(m, m - 6, 250, 96), { alignX: "start", alignY: "start", scale: 0.95 });
      // Address block, right aligned.
      const lines = [scene.text.name, "12 Harbour Street", "Reykjavík 101", domainOf(scene)];
      lines.forEach((l, i) => drawText(f, l, w - m, m + 14 + i * 21, { font: font(i === 0 ? 600 : 400, 15, body), color: i === 0 ? ink : muted, align: "right" }));
      // Accent rule.
      f.fillStyle = scene.colors.accent;
      f.fillRect(m, 200, 46, 3);
      // Letter body (greeked).
      drawText(f, "Dear reader,", m, 262, { font: font(400, 17, body), color: ink });
      let y = greekLines(f, m, 292, w - m * 2, 9, { lineHeight: 22, color: alpha(ink, 0.16), seed: 5, paragraphEvery: 4 });
      y = greekLines(f, m, y + 8, w - m * 2, 6, { lineHeight: 22, color: alpha(ink, 0.16), seed: 9, paragraphEvery: 6 });
      drawText(f, "Warm regards,", m, y + 26, { font: font(400, 17, body), color: ink });
      drawText(f, scene.text.name, m, y + 60, { font: font(600, 22, scene.fonts.display), color: ink });
      // Footer.
      f.fillStyle = alpha(ink, 0.12);
      f.fillRect(m, h - 96, w - m * 2, 1.5);
      drawText(f, `${domainOf(scene)}   ·   hello@${domainOf(scene)}   ·   +354 000 0000`, m, h - 66, { font: font(400, 13, body), color: muted, letterSpacing: 0.3 });
      if (scene.options.showTagline && scene.text.tagline) drawText(f, scene.text.tagline, w - m, h - 66, { font: font(400, 13, scene.fonts.display, true), color: muted, align: "right" });
    }, darken(paper, 0.18), 0.9);

    // DL envelope on top, lower right.
    const ew = 440, eh = 220;
    card(ctx, scene, cam, 150, -260, ew, eh, 0.16, 8, 880, 440, (f, w, h) => {
      const env = mix(paper, scene.colors.neutral, 0.12);
      f.fillStyle = env;
      f.fillRect(0, 0, w, h);
      paperRect(f, scene, 0, 0, w, h, 0.6);
      // Closed flap: shallow triangle from the top edge.
      f.beginPath();
      f.moveTo(0, 0);
      f.lineTo(w, 0);
      f.lineTo(w / 2, h * 0.52);
      f.closePath();
      f.fillStyle = mix(env, "#000000", 0.05);
      f.fill();
      f.strokeStyle = alpha("#000000", 0.08);
      f.lineWidth = 1.5;
      f.stroke();
      // Side seams.
      f.beginPath();
      f.moveTo(0, 0);
      f.lineTo(w * 0.34, h);
      f.moveTo(w, 0);
      f.lineTo(w * 0.66, h);
      f.strokeStyle = alpha("#000000", 0.06);
      f.stroke();
      // Small mark bottom-left and address centred-right.
      const logo = pickLogo(scene, env, { prefer: "primary" });
      drawLogo(f, scene, logo, rect(44, h - 118, 200, 76), { alignX: "start", alignY: "end", scale: 0.85 });
      greekLines(f, w * 0.52, h * 0.6, w * 0.4, 4, { lineHeight: 18, color: alpha(ink, 0.18), seed: 21, paragraphEvery: 9 });
      // Stamp in the top-right corner.
      const s = 78;
      fillRoundRect(f, w - s - 40, 28, s, s * 1.15, 4, brand);
      const mark = pickLogo(scene, brand, { prefer: "mark", force: "mark" });
      drawLogo(f, scene, mark, rect(w - s - 40 + 12, 40, s - 24, s * 1.15 - 24), { scale: 0.8 });
      f.strokeStyle = alpha("#ffffff", 0.5);
      f.lineWidth = 2;
      f.setLineDash([4, 5]);
      f.strokeRect(w - s - 40 + 6, 34, s - 12, s * 1.15 - 12);
      f.setLineDash([]);
    }, darken(paper, 0.2), 1.2);
  },
};

export const STATIONERY: MockupTemplate[] = [businessCard, letterhead];

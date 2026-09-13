/** Social: Instagram profile + post, and a LinkedIn-style cover. */
import { alpha, darken, isDark, lighten, mix } from "../color";
import { backdrop, brandSurface, domainOf, drawLogo, drawParagraph, drawText, excerpt, fillRoundRect, fitFontSize, font, greekLines, handleOf, lightSurface, pickLogo, rect, roundRectPath, shadowedFill, wrapText, type Ctx } from "../draw";
import type { MockupScene, MockupTemplate } from "../types";

/** A square social tile design; `kind` selects one of several on-brand layouts. */
function tile(ctx: Ctx, scene: MockupScene, x: number, y: number, s: number, kind: number, radius = 0): void {
  const c = scene.colors;
  const paper = lightSurface(scene);
  ctx.save();
  roundRectPath(ctx, x, y, s, s, radius);
  ctx.clip();
  const k = kind % 9;
  const bigText = (text: string, bg: string, ink: string) => {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, s, s);
    const size = fitFontSize(ctx, text.split(" ").slice(0, 2).join(" "), scene.fonts.display, 600, s * 0.78, s * 0.2, s * 0.09, -0.01);
    const f = font(600, size, scene.fonts.display);
    const lines = wrapText(ctx, text, f, s * 0.78, 4);
    const lh = size * 1.05;
    let yy = y + s / 2 - ((lines.length - 1) * lh) / 2 + size * 0.36;
    for (const l of lines) {
      drawText(ctx, l, x + s * 0.11, yy, { font: f, color: ink, letterSpacing: -size * 0.01 });
      yy += lh;
    }
  };
  if (k === 0) bigText(scene.text.tagline || scene.text.name, brandSurface(scene), isDark(brandSurface(scene)) ? "#ffffff" : "#111111");
  else if (k === 1) {
    const g = ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, isDark(c.secondary) ? c.secondary : darken(c.secondary, 0.3));
    g.addColorStop(1, c.primary);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    const rg = ctx.createRadialGradient(x + s * 0.75, y + s * 0.3, 0, x + s * 0.75, y + s * 0.3, s * 0.7);
    rg.addColorStop(0, alpha(c.accent, 0.7));
    rg.addColorStop(1, alpha(c.accent, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x, y, s, s);
    drawLogo(ctx, scene, pickLogo(scene, c.primary, { prefer: "mark", force: "mark" }), rect(x + s * 0.08, y + s * 0.72, s * 0.2, s * 0.2));
  } else if (k === 2) {
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, s, s);
    drawLogo(ctx, scene, pickLogo(scene, paper, { prefer: "primary" }), rect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6));
  } else if (k === 3) {
    const bg = c.accent;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, s, s);
    const ink = isDark(bg) ? "#ffffff" : "#111111";
    drawText(ctx, (scene.text.name[0] ?? "A").toUpperCase(), x + s / 2, y + s * 0.76, { font: font(600, s * 0.7, scene.fonts.display), color: ink, align: "center" });
  } else if (k === 4) {
    const bg = mix(c.neutral, "#ffffff", 0.2);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, s, s);
    drawLogo(ctx, scene, pickLogo(scene, bg, { prefer: "wordmark", force: "wordmark" }), rect(x + s * 0.12, y + s * 0.3, s * 0.76, s * 0.4));
  } else if (k === 5) {
    const bg = isDark(c.secondary) ? c.secondary : darken(c.secondary, 0.3);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = alpha("#ffffff", 0.35);
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    drawLogo(ctx, scene, pickLogo(scene, bg, { prefer: "mark", force: "mark" }), rect(x + s * 0.32, y + s * 0.32, s * 0.36, s * 0.36));
  } else if (k === 6) {
    const g = ctx.createLinearGradient(x, y + s, x + s, y);
    g.addColorStop(0, c.primary);
    g.addColorStop(1, lighten(c.primary, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = alpha("#000000", 0.18);
    ctx.beginPath();
    ctx.ellipse(x + s * 0.5, y + s * 0.95, s * 0.6, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha("#ffffff", 0.22);
    ctx.beginPath();
    ctx.arc(x + s * 0.72, y + s * 0.28, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (k === 7) {
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, s, s);
    drawText(ctx, "“", x + s * 0.12, y + s * 0.36, { font: font(600, s * 0.34, scene.fonts.display), color: c.accent });
    greekLines(ctx, x + s * 0.12, y + s * 0.42, s * 0.76, 4, { lineHeight: s * 0.09, thickness: s * 0.035, color: alpha(c.text, 0.22), seed: 41, paragraphEvery: 4 });
    drawLogo(ctx, scene, pickLogo(scene, paper, { prefer: "mark", force: "mark" }), rect(x + s * 0.12, y + s * 0.8, s * 0.12, s * 0.12));
  } else {
    ctx.fillStyle = brandSurface(scene);
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = alpha(isDark(brandSurface(scene)) ? "#ffffff" : "#000000", 0.5);
    ctx.lineWidth = Math.max(1, s * 0.012);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y + s * 0.9, s * (0.2 + i * 0.16), Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function avatar(ctx: Ctx, scene: MockupScene, cx: number, cy: number, r: number, ring?: string): void {
  const fill = brandSurface(scene);
  if (ring) {
    const g = ctx.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
    g.addColorStop(0, scene.colors.accent);
    g.addColorStop(1, scene.colors.primary);
    ctx.fillStyle = ring === "gradient" ? g : ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lightSurface(scene);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  drawLogo(ctx, scene, pickLogo(scene, fill, { prefer: "mark", force: "mark" }), rect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1));
  ctx.restore();
}

function heart(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.11;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 0.2, y + s * 0.4, x + s * 0.1, y - s * 0.05, x + s / 2, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 0.05, x + s * 1.2, y + s * 0.4, x + s / 2, y + s * 0.9);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export const instagram: MockupTemplate = {
  id: "instagram",
  name: "Instagram profile & post",
  category: "social",
  size: { width: 1200, height: 900 },
  description: "Profile grid on a phone next to a full-size feed post.",
  featured: 10,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const c = scene.colors;
    const dark = scene.options.theme === "dark";
    const surface = dark ? "#0e0f12" : "#ffffff";
    const ink = dark ? "#f2f2f2" : "#111111";
    const muted = alpha(ink, 0.55);
    const body = scene.fonts.body;

    // Phone.
    const px = 100, py = 60, pw = 360, ph = 780, pr = 56;
    shadowedFill(ctx, () => roundRectPath(ctx, px, py, pw, ph, pr), "#101114", [
      { blur: 80, x: 8, y: 40, color: "rgba(0,0,0,0.38)" },
      { blur: 14, y: 6, color: "rgba(0,0,0,0.3)" },
    ]);
    ctx.save();
    roundRectPath(ctx, px + 1.5, py + 1.5, pw - 3, ph - 3, pr - 1);
    ctx.strokeStyle = "#34363c";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    const sx = px + 12, sy = py + 12, sw = pw - 24, sh = ph - 24;
    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, pr - 12);
    ctx.clip();
    ctx.fillStyle = surface;
    ctx.fillRect(sx, sy, sw, sh);
    drawText(ctx, "9:41", sx + 30, sy + 34, { font: font(600, 15, body), color: ink });
    fillRoundRect(ctx, sx + sw / 2 - 48, sy + 12, 96, 28, 14, "#0b0b0d");
    fillRoundRect(ctx, sx + sw - 54, sy + 22, 24, 12, 3, alpha(ink, 0.9));
    // Header.
    drawText(ctx, handleOf(scene), sx + sw / 2, sy + 86, { font: font(700, 16, body), color: ink, align: "center" });
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 30, sy + 80);
    ctx.lineTo(sx + 22, sy + 88);
    ctx.lineTo(sx + 30, sy + 96);
    ctx.stroke();
    for (let i = 0; i < 3; i++) fillRoundRect(ctx, sx + sw - 34, sy + 78 + i * 6, 14, 2, 1, ink);
    // Profile row.
    avatar(ctx, scene, sx + 56, sy + 158, 38, "gradient");
    const stats: [string, string][] = [["128", "Posts"], ["12.4k", "Followers"], ["302", "Following"]];
    stats.forEach(([n, l], i) => {
      const cx = sx + 138 + i * 66;
      drawText(ctx, n, cx, sy + 154, { font: font(700, 16, body), color: ink, align: "center" });
      drawText(ctx, l, cx, sy + 172, { font: font(400, 11, body), color: muted, align: "center" });
    });
    drawText(ctx, scene.text.name, sx + 18, sy + 226, { font: font(700, 14, body), color: ink });
    let yy = drawParagraph(ctx, excerpt(scene.text.positioning, 90) || "Brand", sx + 18, sy + 246, { font: font(400, 12.5, body), color: alpha(ink, 0.85), maxWidth: sw - 36, lineHeight: 17, maxLines: 2 });
    drawText(ctx, domainOf(scene), sx + 18, yy + 2, { font: font(500, 12.5, body), color: isDark(surface) ? lighten(c.primary, 0.35) : c.primary });
    yy += 22;
    // Buttons.
    const bw = (sw - 36 - 8) / 2;
    const follow = isDark(surface) ? (isDark(c.primary) ? lighten(c.primary, 0.25) : c.primary) : c.primary;
    fillRoundRect(ctx, sx + 18, yy, bw, 32, 8, follow);
    drawText(ctx, "Follow", sx + 18 + bw / 2, yy + 21, { font: font(600, 13, body), color: isDark(follow) ? "#ffffff" : "#111111", align: "center" });
    fillRoundRect(ctx, sx + 26 + bw, yy, bw, 32, 8, alpha(ink, 0.08));
    drawText(ctx, "Message", sx + 26 + bw + bw / 2, yy + 21, { font: font(600, 13, body), color: ink, align: "center" });
    yy += 52;
    // Highlights.
    const hl = ["New", "Story", "Team", "Press"];
    const hlCols = [c.primary, c.accent, isDark(c.secondary) ? c.secondary : darken(c.secondary, 0.3), c.neutral];
    hl.forEach((label, i) => {
      const cx = sx + 44 + i * 74;
      ctx.strokeStyle = alpha(ink, 0.2);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, yy + 28, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hlCols[i];
      ctx.beginPath();
      ctx.arc(cx, yy + 28, 25, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, label, cx, yy + 76, { font: font(400, 11, body), color: ink, align: "center" });
    });
    yy += 96;
    // Tabs.
    ctx.fillStyle = alpha(ink, 0.12);
    ctx.fillRect(sx, yy + 30, sw, 1);
    ctx.fillStyle = ink;
    ctx.fillRect(sx, yy + 29, sw / 3, 2);
    for (let i = 0; i < 3; i++) {
      const cx = sx + sw / 6 + (i * sw) / 3;
      ctx.strokeStyle = i === 0 ? ink : alpha(ink, 0.35);
      ctx.lineWidth = 1.5;
      if (i === 0) {
        ctx.strokeRect(cx - 9, yy + 2, 18, 18);
        ctx.beginPath();
        ctx.moveTo(cx - 3, yy + 2); ctx.lineTo(cx - 3, yy + 20);
        ctx.moveTo(cx + 3, yy + 2); ctx.lineTo(cx + 3, yy + 20);
        ctx.moveTo(cx - 9, yy + 8); ctx.lineTo(cx + 9, yy + 8);
        ctx.moveTo(cx - 9, yy + 14); ctx.lineTo(cx + 9, yy + 14);
        ctx.stroke();
      } else if (i === 1) {
        roundRectPath(ctx, cx - 9, yy + 2, 18, 18, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 2, yy + 7); ctx.lineTo(cx + 4, yy + 11); ctx.lineTo(cx - 2, yy + 15);
        ctx.closePath();
        ctx.stroke();
      } else {
        roundRectPath(ctx, cx - 9, yy + 2, 18, 18, 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, yy + 9, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    yy += 32;
    // Grid.
    const gap = 2, ts = (sw - gap * 2) / 3;
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      tile(ctx, scene, sx + col * (ts + gap), yy + row * (ts + gap), ts, [0, 1, 2, 3, 4, 5, 6, 7, 8][i]);
    }
    ctx.restore();

    // Feed post card.
    const cx0 = 540, cy0 = 84, cw = 590;
    const imgH = cw;
    const ch = 58 + imgH + 46 + 76;
    shadowedFill(ctx, () => roundRectPath(ctx, cx0, cy0, cw, ch, 16), surface, [
      { blur: 60, y: 24, color: "rgba(0,0,0,0.28)" },
      { blur: 10, y: 4, color: "rgba(0,0,0,0.18)" },
    ]);
    ctx.save();
    roundRectPath(ctx, cx0, cy0, cw, ch, 16);
    ctx.clip();
    avatar(ctx, scene, cx0 + 34, cy0 + 29, 17, "gradient");
    drawText(ctx, handleOf(scene).slice(1), cx0 + 62, cy0 + 26, { font: font(700, 13.5, body), color: ink });
    drawText(ctx, domainOf(scene), cx0 + 62, cy0 + 42, { font: font(400, 11.5, body), color: muted });
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx0 + cw - 40 + i * 7, cy0 + 29, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Post image: tagline layout with the mark.
    const iy = cy0 + 58;
    const brand = brandSurface(scene);
    tile(ctx, scene, cx0, iy, cw, 0);
    drawLogo(ctx, scene, pickLogo(scene, brand, { prefer: "mark", force: "mark" }), rect(cx0 + cw - 120, iy + 40, 80, 80));
    ctx.fillStyle = alpha(isDark(brand) ? "#ffffff" : "#000000", 0.5);
    ctx.fillRect(cx0 + cw * 0.11, iy + cw - 74, 60, 2);
    drawText(ctx, scene.text.name.toUpperCase(), cx0 + cw * 0.11, iy + cw - 44, { font: font(600, 12, body), color: alpha(isDark(brand) ? "#ffffff" : "#000000", 0.8), letterSpacing: 2.5 });
    // Actions.
    const ay = iy + imgH + 14;
    heart(ctx, cx0 + 18, ay + 2, 22, ink);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.arc(cx0 + 66, ay + 13, 10, Math.PI * 0.2, Math.PI * 1.9);
    ctx.lineTo(cx0 + 56, ay + 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx0 + 96, ay + 10); ctx.lineTo(cx0 + 120, ay + 2); ctx.lineTo(cx0 + 112, ay + 26); ctx.lineTo(cx0 + 106, ay + 15); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx0 + cw - 38, ay + 2); ctx.lineTo(cx0 + cw - 20, ay + 2); ctx.lineTo(cx0 + cw - 20, ay + 26); ctx.lineTo(cx0 + cw - 29, ay + 18); ctx.lineTo(cx0 + cw - 38, ay + 26); ctx.closePath();
    ctx.stroke();
    drawText(ctx, "1,284 likes", cx0 + 18, ay + 54, { font: font(700, 13, body), color: ink });
    const cap = `${handleOf(scene).slice(1)}  ${excerpt(scene.text.positioning, 120) || scene.text.tagline}`;
    drawParagraph(ctx, cap, cx0 + 18, ay + 74, { font: font(400, 13, body), color: alpha(ink, 0.9), maxWidth: cw - 36, lineHeight: 18, maxLines: 2 });
    ctx.restore();
  },
};

export const socialCover: MockupTemplate = {
  id: "social-cover",
  name: "Social cover",
  category: "social",
  size: { width: 1200, height: 900 },
  description: "Profile page with a branded banner, avatar and headline.",
  featured: 11,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const c = scene.colors;
    const dark = scene.options.theme === "dark";
    const surface = dark ? "#17181c" : "#ffffff";
    const ink = dark ? "#f2f2f2" : "#111111";
    const muted = alpha(ink, 0.6);
    const body = scene.fonts.body;
    const cx0 = 100, cy0 = 110, cw = 1000, ch = 700;
    shadowedFill(ctx, () => roundRectPath(ctx, cx0, cy0, cw, ch, 18), surface, [
      { blur: 70, y: 30, color: "rgba(0,0,0,0.3)" },
      { blur: 10, y: 4, color: "rgba(0,0,0,0.16)" },
    ]);
    ctx.save();
    roundRectPath(ctx, cx0, cy0, cw, ch, 18);
    ctx.clip();
    // Banner 4:1.
    const bh = 250;
    const brand = brandSurface(scene);
    const g = ctx.createLinearGradient(cx0, cy0, cx0 + cw, cy0 + bh);
    g.addColorStop(0, brand);
    g.addColorStop(1, isDark(c.secondary) ? mix(c.secondary, brand, 0.3) : darken(brand, 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(cx0, cy0, cw, bh);
    const rg = ctx.createRadialGradient(cx0 + cw * 0.85, cy0 + bh * 0.1, 0, cx0 + cw * 0.85, cy0 + bh * 0.1, 520);
    rg.addColorStop(0, alpha(c.accent, 0.5));
    rg.addColorStop(1, alpha(c.accent, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(cx0, cy0, cw, bh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx0, cy0, cw, bh);
    ctx.clip();
    drawLogo(ctx, scene, pickLogo(scene, brand, { prefer: "mark", force: "mark" }), rect(cx0 + cw - 300, cy0 - 40, 340, 340), { alpha: 0.12, scale: 1 });
    ctx.restore();
    const bInk = isDark(brand) ? "#ffffff" : "#111111";
    const logo = pickLogo(scene, brand, { prefer: "primary" });
    drawLogo(ctx, scene, logo, rect(cx0 + 60, cy0 + 36, 300, 106), { alignX: "start", scale: 0.95 });
    if (scene.options.showTagline && scene.text.tagline) {
      const size = fitFontSize(ctx, scene.text.tagline, scene.fonts.display, 400, 470, 44, 22);
      drawParagraph(ctx, scene.text.tagline, cx0 + cw - 60, cy0 + 120 + size * 0.4, { font: font(400, size, scene.fonts.display, true), color: alpha(bInk, 0.92), align: "right", maxWidth: 470, lineHeight: size * 1.1, maxLines: 2 });
    }
    // Avatar.
    avatar(ctx, scene, cx0 + 150, cy0 + bh, 84, surface);
    // Name / headline / meta.
    drawText(ctx, scene.text.name, cx0 + 60, cy0 + bh + 140, { font: font(700, 30, body), color: ink });
    const sub = excerpt(scene.text.positioning, 120) || scene.text.tagline;
    let yy = drawParagraph(ctx, sub, cx0 + 60, cy0 + bh + 172, { font: font(400, 16, body), color: alpha(ink, 0.85), maxWidth: 540, lineHeight: 23, maxLines: 2 });
    drawText(ctx, `${domainOf(scene)}  ·  12,400 followers  ·  Est. 2016`, cx0 + 60, yy + 12, { font: font(400, 14, body), color: muted });
    yy += 46;
    const follow = c.primary;
    fillRoundRect(ctx, cx0 + 60, yy, 110, 38, 19, follow);
    drawText(ctx, "Follow", cx0 + 115, yy + 24, { font: font(600, 14, body), color: isDark(follow) ? "#ffffff" : "#111111", align: "center" });
    ctx.strokeStyle = alpha(ink, 0.35);
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, cx0 + 182, yy, 110, 38, 19);
    ctx.stroke();
    drawText(ctx, "Message", cx0 + 237, yy + 24, { font: font(600, 14, body), color: ink, align: "center" });
    roundRectPath(ctx, cx0 + 304, yy, 44, 38, 19);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx0 + 319 + i * 7, yy + 19, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // About column.
    const ax = cx0 + 680;
    ctx.fillStyle = alpha(ink, 0.1);
    ctx.fillRect(ax - 40, cy0 + bh + 100, 1, 260);
    drawText(ctx, "About", ax, cy0 + bh + 122, { font: font(700, 15, body), color: ink });
    greekLines(ctx, ax, cy0 + bh + 140, 260, 5, { lineHeight: 16, thickness: 6, color: alpha(ink, 0.14), seed: 51, paragraphEvery: 5 });
    drawText(ctx, "Website", ax, cy0 + bh + 262, { font: font(700, 13, body), color: ink });
    drawText(ctx, domainOf(scene), ax, cy0 + bh + 284, { font: font(500, 13, body), color: isDark(surface) ? lighten(c.primary, 0.3) : c.primary });
    drawText(ctx, "Industry", ax, cy0 + bh + 320, { font: font(700, 13, body), color: ink });
    drawText(ctx, scene.genome.brief.industry || "Brand", ax, cy0 + bh + 342, { font: font(400, 13, body), color: muted, maxWidth: 260 });
    ctx.restore();
  },
};

export const SOCIAL: MockupTemplate[] = [instagram, socialCover];

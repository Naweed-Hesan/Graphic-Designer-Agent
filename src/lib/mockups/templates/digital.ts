/** Digital: app icon on a phone home screen, website hero on a laptop. */
import { alpha, darken, isDark, lighten, mix } from "../color";
import { backdrop, brandSurface, domainOf, drawLogo, drawParagraph, drawText, excerpt, fillRoundRect, fitFontSize, font, glyphTile, greekLines, groundShadow, inkOn, lightSurface, mutedInkOn, pickLogo, rect, roundRectPath, shadowedFill, wrapText, type Ctx } from "../draw";
import type { MockupScene, MockupTemplate } from "../types";

const APP_NAMES = ["Mail", "Notes", "Weather", "Photos", "Music", "Maps", "Calendar", "Files", "Clock", "Camera", "Wallet", "Health", "Books", "Podcasts", "News", "Settings", "Stocks", "Fitness", "Home"];

function brandIcon(ctx: Ctx, scene: MockupScene, x: number, y: number, s: number, withShadow = true): void {
  const fill = brandSurface(scene);
  const path = () => roundRectPath(ctx, x, y, s, s, s * 0.225);
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, lighten(fill, 0.08));
  g.addColorStop(1, darken(fill, 0.1));
  if (withShadow) shadowedFill(ctx, path, g, [{ blur: s * 0.25, y: s * 0.08, color: "rgba(0,0,0,0.28)" }]);
  else {
    path();
    ctx.fillStyle = g;
    ctx.fill();
  }
  const mark = pickLogo(scene, fill, { prefer: "mark", force: "mark" });
  drawLogo(ctx, scene, mark, rect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6));
  ctx.save();
  path();
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + s);
  gl.addColorStop(0, "rgba(255,255,255,0.12)");
  gl.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, s, s);
  ctx.restore();
}

function statusBar(ctx: Ctx, x: number, y: number, w: number, color: string): void {
  drawText(ctx, "9:41", x + 34, y + 30, { font: font(600, 16, "-apple-system, Inter, sans-serif"), color });
  const rx = x + w - 34;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) fillRoundRect(ctx, rx - 70 + i * 6, y + 26 - i * 3 - 4, 4, 7 + i * 3, 1, color);
  ctx.beginPath();
  ctx.arc(rx - 34, y + 30, 8, Math.PI * 1.22, Math.PI * 1.78);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rx - 34, y + 30, 3.5, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.strokeStyle = alpha(color, 0.5);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, rx - 24, y + 18, 24, 12, 3.5);
  ctx.stroke();
  fillRoundRect(ctx, rx - 22, y + 20, 17, 8, 2, color);
  ctx.fillRect(rx + 1, y + 22, 2, 4);
}

export const appIcon: MockupTemplate = {
  id: "app-icon",
  name: "App icon",
  category: "digital",
  size: { width: 1200, height: 900 },
  description: "Home-screen icon on a phone with the icon shown at several sizes.",
  featured: 7,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const c = scene.colors;
    const bd = backdropIsDark(scene);
    const ink = bd ? "#ffffff" : c.text;

    // Icon specimens on the left.
    brandIcon(ctx, scene, 150, 220, 280);
    drawText(ctx, scene.text.name, 290, 548, { font: font(600, 20, scene.fonts.body), color: ink, align: "center" });
    drawText(ctx, "1024 × 1024", 290, 574, { font: font(400, 14, scene.fonts.body), color: alpha(ink, 0.55), align: "center", letterSpacing: 1 });
    const sizes = [120, 76, 40];
    let sx = 150;
    for (const s of sizes) {
      brandIcon(ctx, scene, sx, 700 - s, s, true);
      drawText(ctx, `${s}`, sx + s / 2, 728, { font: font(400, 12, scene.fonts.body), color: alpha(ink, 0.5), align: "center" });
      sx += s + 34;
    }

    // Phone.
    const px = 690, py = 60, pw = 372, ph = 780, pr = 60;
    shadowedFill(ctx, () => roundRectPath(ctx, px, py, pw, ph, pr), "#0f1012", [
      { blur: 90, x: 10, y: 50, color: "rgba(0,0,0,0.38)" },
      { blur: 16, y: 8, color: "rgba(0,0,0,0.3)" },
    ]);
    ctx.save();
    roundRectPath(ctx, px, py, pw, ph, pr);
    ctx.clip();
    const eg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    eg.addColorStop(0, "#3a3c42");
    eg.addColorStop(0.5, "#141518");
    eg.addColorStop(1, "#2a2c31");
    ctx.strokeStyle = eg;
    ctx.lineWidth = 6;
    roundRectPath(ctx, px + 1.5, py + 1.5, pw - 3, ph - 3, pr - 1);
    ctx.stroke();
    ctx.restore();
    const sx0 = px + 12, sy0 = py + 12, sw = pw - 24, sh = ph - 24, sr = pr - 12;
    ctx.save();
    roundRectPath(ctx, sx0, sy0, sw, sh, sr);
    ctx.clip();
    // Wallpaper.
    const wg = ctx.createLinearGradient(sx0, sy0, sx0 + sw, sy0 + sh);
    wg.addColorStop(0, isDark(c.primary) ? c.primary : darken(c.primary, 0.2));
    wg.addColorStop(1, isDark(c.secondary) ? c.secondary : darken(c.secondary, 0.4));
    ctx.fillStyle = wg;
    ctx.fillRect(sx0, sy0, sw, sh);
    const blob = (bx: number, by: number, r: number, col: string, a: number) => {
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, alpha(col, a));
      g.addColorStop(1, alpha(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(sx0, sy0, sw, sh);
    };
    blob(sx0 + sw * 0.85, sy0 + sh * 0.2, 260, c.accent, 0.55);
    blob(sx0 + sw * 0.15, sy0 + sh * 0.85, 300, c.neutral, 0.35);
    blob(sx0 + sw * 0.5, sy0 + sh * 0.55, 200, lighten(c.primary, 0.3), 0.25);
    statusBar(ctx, sx0, sy0 + 6, sw, "#ffffff");
    // Dynamic island.
    fillRoundRect(ctx, sx0 + sw / 2 - 52, sy0 + 12, 104, 30, 15, "#0b0b0d");
    // Grid.
    const icon = 62, margin = 24, gap = (sw - margin * 2 - icon * 4) / 3;
    let n = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        const ix = sx0 + margin + col * (icon + gap);
        const iy = sy0 + 100 + row * 96;
        if (row === 0 && col === 0) {
          brandIcon(ctx, scene, ix, iy, icon);
          drawText(ctx, scene.text.name, ix + icon / 2, iy + icon + 17, { font: font(500, 11, scene.fonts.body), color: "#ffffff", align: "center", maxWidth: icon + 14 });
        } else {
          ctx.save();
          roundRectPath(ctx, ix, iy, icon, icon, icon * 0.225);
          ctx.fillStyle = "rgba(255,255,255,0.20)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
          const shapes = ["circle", "square", "lines"] as const;
          glyphTile(ctx, ix + icon * 0.2, iy + icon * 0.2, icon * 0.6, "rgba(255,255,255,0)", "rgba(255,255,255,0.75)", shapes[n % 3]);
          drawText(ctx, APP_NAMES[n % APP_NAMES.length], ix + icon / 2, iy + icon + 17, { font: font(500, 11, scene.fonts.body), color: "rgba(255,255,255,0.92)", align: "center" });
          n++;
        }
      }
    }
    // Page dots.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 0 ? "#ffffff" : "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(sx0 + sw / 2 - 14 + i * 14, sy0 + sh - 112, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dock.
    fillRoundRect(ctx, sx0 + 14, sy0 + sh - 94, sw - 28, 82, 30, "rgba(255,255,255,0.18)");
    for (let i = 0; i < 4; i++) {
      const ix = sx0 + 14 + 16 + i * (icon + (sw - 28 - 32 - icon * 4) / 3);
      const iy = sy0 + sh - 94 + 10;
      roundRectPath(ctx, ix, iy, icon, icon, icon * 0.225);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();
      glyphTile(ctx, ix + icon * 0.2, iy + icon * 0.2, icon * 0.6, "rgba(255,255,255,0)", "rgba(255,255,255,0.8)", (["lines", "circle", "square", "circle"] as const)[i]);
    }
    // Home indicator.
    fillRoundRect(ctx, sx0 + sw / 2 - 60, sy0 + sh - 10, 120, 4, 2, "rgba(255,255,255,0.9)");
    ctx.restore();
  },
};

function backdropIsDark(scene: MockupScene): boolean {
  return scene.options.theme === "dark" || (!!scene.options.background && isDark(scene.options.background));
}

export const websiteLaptop: MockupTemplate = {
  id: "website-laptop",
  name: "Website on laptop",
  category: "digital",
  size: { width: 1200, height: 900 },
  description: "Landing-page hero in a browser on a laptop, buttons in the accent colour.",
  featured: 4,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const c = scene.colors;
    const dark = scene.options.theme === "dark";
    // Laptop base.
    groundShadow(ctx, 600, 760, 640, 48, 0.4);
    const bx = 40, by = 700, bw = 1120, bh = 40;
    shadowedFill(ctx, () => roundRectPath(ctx, bx, by, bw, bh, 12), "#c6c9cf", [{ blur: 30, y: 12, color: "rgba(0,0,0,0.35)" }]);
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, "#e2e4e8");
    bg.addColorStop(0.35, "#c9ccd2");
    bg.addColorStop(1, "#9ea2a9");
    roundRectPath(ctx, bx, by, bw, bh, 12);
    ctx.fillStyle = bg;
    ctx.fill();
    fillRoundRect(ctx, 600 - 90, by, 180, 10, 5, "#a9adb4");
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(bx + 12, by + 1, bw - 24, 1.5);
    // Lid.
    const lx = 110, ly = 70, lw = 980, lh = 630;
    shadowedFill(ctx, () => roundRectPath(ctx, lx, ly, lw, lh, 22), "#1b1c1f", [{ blur: 50, y: 20, color: "rgba(0,0,0,0.4)" }]);
    const lg = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
    lg.addColorStop(0, "#2d2f34");
    lg.addColorStop(1, "#111214");
    roundRectPath(ctx, lx, ly, lw, lh, 22);
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, lx + 1, ly + 1, lw - 2, lh - 2, 21);
    ctx.stroke();
    ctx.fillStyle = "#0a0a0c";
    ctx.beginPath();
    ctx.arc(600, ly + 9, 3, 0, Math.PI * 2);
    ctx.fill();

    // Screen.
    const sx = 128, sy = 88, sw = 944, sh = 594;
    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, 8);
    ctx.clip();
    const page = dark ? mix(isDark(c.secondary) ? c.secondary : "#15171b", "#101114", 0.5) : lightSurface(scene);
    const ink = inkOn(scene, page);
    const muted = mutedInkOn(scene, page);
    ctx.fillStyle = page;
    ctx.fillRect(sx, sy, sw, sh);
    // Browser chrome.
    const chrome = dark ? "#24262b" : "#ececef";
    ctx.fillStyle = chrome;
    ctx.fillRect(sx, sy, sw, 42);
    ctx.fillStyle = dark ? "#000000" : "#d9d9de";
    ctx.fillRect(sx, sy + 42, sw, 1);
    for (const [i, col] of ["#ff5f57", "#febc2e", "#28c840"].entries()) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx + 22 + i * 18, sy + 21, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    fillRoundRect(ctx, sx + 92, sy + 8, 220, 26, 7, dark ? "#15171b" : "#ffffff");
    drawText(ctx, scene.text.name, sx + 104, sy + 26, { font: font(500, 12, scene.fonts.body), color: ink, maxWidth: 190 });
    fillRoundRect(ctx, sx + 340, sy + 9, 470, 24, 12, dark ? "#15171b" : "#ffffff");
    drawText(ctx, `https://${domainOf(scene)}`, sx + 575, sy + 25, { font: font(400, 12, scene.fonts.body), color: muted, align: "center" });
    // Nav.
    const cy0 = sy + 43;
    const navLogo = pickLogo(scene, page, { prefer: "primary" });
    drawLogo(ctx, scene, navLogo, rect(sx + 44, cy0 + 16, 150, 34), { alignX: "start", scale: 0.95 });
    const items = ["Products", "About", "Journal", "Contact"];
    let ix = sx + sw - 44 - 118;
    for (let i = items.length - 1; i >= 0; i--) {
      const w = drawText(ctx, items[i], ix, cy0 + 38, { font: font(500, 13, scene.fonts.body), color: muted, align: "right" });
      ix -= w + 26;
    }
    const cta = isDark(page) ? (isDark(c.accent) ? lighten(c.accent, 0.2) : c.accent) : c.primary;
    fillRoundRect(ctx, sx + sw - 44 - 104, cy0 + 18, 104, 32, 16, cta);
    drawText(ctx, "Get started", sx + sw - 44 - 52, cy0 + 38, { font: font(600, 12, scene.fonts.body), color: isDark(cta) ? "#ffffff" : "#111111", align: "center" });
    // Hero.
    const hx = sx + 44, hy = cy0 + 96, colW = 430;
    const eyebrow = (scene.genome.brief.industry || "Introducing").toUpperCase();
    drawText(ctx, eyebrow, hx, hy, { font: font(600, 11, scene.fonts.body), color: isDark(page) ? lighten(c.accent, 0.2) : c.accent, letterSpacing: 2 });
    const headline = scene.options.showTagline && scene.text.tagline ? scene.text.tagline : scene.text.name;
    const hs = fitFontSize(ctx, headline.split(" ").slice(0, 3).join(" "), scene.fonts.display, 600, colW, 54, 30, -0.015);
    const hFont = font(600, hs, scene.fonts.display);
    const hLines = wrapText(ctx, headline, hFont, colW, 3);
    let yy = hy + 22 + hs;
    for (const l of hLines) {
      drawText(ctx, l, hx, yy, { font: hFont, color: ink, letterSpacing: -hs * 0.015 });
      yy += hs * 1.08;
    }
    yy -= hs * 1.08;
    const sub = excerpt(scene.text.positioning || scene.genome.brief.description, 150);
    if (sub) yy = drawParagraph(ctx, sub, hx, yy + 46, { font: font(400, 14, scene.fonts.body), color: muted, maxWidth: colW - 30, lineHeight: 22, maxLines: 3 });
    yy += 14;
    const accentBtn = isDark(page) ? c.accent : c.accent;
    fillRoundRect(ctx, hx, yy, 124, 40, 8, accentBtn);
    drawText(ctx, "Shop now", hx + 62, yy + 25, { font: font(600, 13, scene.fonts.body), color: isDark(accentBtn) ? "#ffffff" : "#111111", align: "center" });
    ctx.strokeStyle = alpha(ink, 0.25);
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, hx + 138, yy, 124, 40, 8);
    ctx.stroke();
    drawText(ctx, "Our story →", hx + 200, yy + 25, { font: font(500, 13, scene.fonts.body), color: ink, align: "center" });
    // Hero image block.
    const imx = sx + 524, imy = cy0 + 60, imw = 376, imh = 350;
    roundRectPath(ctx, imx, imy, imw, imh, 16);
    const ig = ctx.createLinearGradient(imx, imy, imx + imw, imy + imh);
    ig.addColorStop(0, c.primary);
    ig.addColorStop(1, isDark(c.secondary) ? c.secondary : darken(c.secondary, 0.3));
    ctx.fillStyle = ig;
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, imx, imy, imw, imh, 16);
    ctx.clip();
    const rg = ctx.createRadialGradient(imx + imw * 0.8, imy + imh * 0.2, 0, imx + imw * 0.8, imy + imh * 0.2, imw * 0.8);
    rg.addColorStop(0, alpha(c.accent, 0.6));
    rg.addColorStop(1, alpha(c.accent, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(imx, imy, imw, imh);
    const ghost = pickLogo(scene, c.primary, { prefer: "mark", force: "mark" });
    drawLogo(ctx, scene, ghost, rect(imx + 40, imy + 40, imw - 80, imh - 80), { alpha: 0.22, scale: 1.1 });
    ctx.restore();
    // Cards row.
    const cyC = cy0 + 448;
    for (let i = 0; i < 3; i++) {
      const cxC = sx + 44 + i * 292;
      fillRoundRect(ctx, cxC, cyC, 272, 120, 12, dark ? alpha("#ffffff", 0.06) : alpha(c.neutral, 0.22));
      fillRoundRect(ctx, cxC + 18, cyC + 18, 28, 28, 8, i === 1 ? c.accent : c.primary);
      drawText(ctx, ["Single origin", "Subscriptions", "Wholesale"][i], cxC + 58, cyC + 38, { font: font(600, 13, scene.fonts.body), color: ink });
      greekLines(ctx, cxC + 18, cyC + 64, 236, 2, { lineHeight: 14, thickness: 5, color: alpha(ink, 0.16), seed: 30 + i, paragraphEvery: 2 });
    }
    ctx.restore();
    // Screen glare.
    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, 8);
    ctx.clip();
    const glare = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh);
    glare.addColorStop(0, "rgba(255,255,255,0.10)");
    glare.addColorStop(0.45, "rgba(255,255,255,0.02)");
    glare.addColorStop(0.46, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
  },
};

export const DIGITAL: MockupTemplate[] = [websiteLaptop, appIcon];

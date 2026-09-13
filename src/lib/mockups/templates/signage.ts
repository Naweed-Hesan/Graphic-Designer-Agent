/** Signage: storefront fascia and a roadside billboard. */
import { alpha, darken, isDark, lighten, mix } from "../color";
import { backdropColor, brandSurface, domainOf, drawFace, drawLogo, drawParagraph, drawText, fillRoundRect, fitFontSize, font, grainRect, pickLogo, rect, shadowedFill, type Ctx } from "../draw";
import { mulberry32 } from "../noise";
import type { Quad } from "../perspective";
import type { MockupTemplate } from "../types";

/** Soft pool of light from a fixture: a radial falloff inside a cone, blurred so the edges melt. */
function lampCone(ctx: Ctx, x: number, headY: number, bottomY: number, spread: number, strength: number): void {
  const h = bottomY - headY;
  ctx.save();
  ctx.filter = `blur(${Math.max(6, spread * 0.12)}px)`;
  const g = ctx.createRadialGradient(x, headY, 0, x, headY, h * 1.05);
  g.addColorStop(0, `rgba(255, 244, 220, ${strength})`);
  g.addColorStop(0.45, `rgba(255, 244, 220, ${strength * 0.45})`);
  g.addColorStop(1, "rgba(255, 244, 220, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 12, headY);
  ctx.lineTo(x + 12, headY);
  ctx.lineTo(x + spread, bottomY);
  ctx.lineTo(x - spread, bottomY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function lampHead(ctx: Ctx, x: number, y: number, dark: string): void {
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y - 34);
  ctx.quadraticCurveTo(x, y - 8, x - 4, y - 4);
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 2);
  ctx.lineTo(x + 22, y - 2);
  ctx.lineTo(x + 14, y + 10);
  ctx.lineTo(x - 14, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 244, 220, 0.9)";
  ctx.fillRect(x - 12, y + 8, 24, 3);
  ctx.restore();
}

export const storefront: MockupTemplate = {
  id: "storefront",
  name: "Storefront sign",
  category: "signage",
  size: { width: 1200, height: 900 },
  description: "Lit fascia sign over a glazed shopfront, with a projecting blade sign.",
  featured: 2,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    const night = scene.options.theme === "dark";
    const base = backdropColor(scene);
    const wall = night ? mix(base, "#2b2e34", 0.5) : mix(base, "#d8d2c6", 0.5);
    const brand = brandSurface(scene);
    const frame = night ? "#1a1c20" : "#23262b";

    // Wall with plaster gradient.
    const wg = ctx.createLinearGradient(0, 0, 0, H);
    wg.addColorStop(0, lighten(wall, night ? 0.02 : 0.08));
    wg.addColorStop(1, darken(wall, night ? 0.35 : 0.06));
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, H);
    // Stone courses, very faint.
    ctx.strokeStyle = alpha(isDark(wall) ? "#ffffff" : "#000000", 0.05);
    ctx.lineWidth = 1;
    for (let y = 60; y < H; y += 58) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    grainRect(ctx, scene, 0, 0, W, H, 0.8);

    // Pavement.
    const pavY = 790;
    ctx.fillStyle = night ? "#2a2c30" : "#b9b5ad";
    ctx.fillRect(0, pavY, W, H - pavY);
    ctx.fillStyle = night ? "#3a3d43" : "#cfcbc3";
    ctx.fillRect(0, pavY, W, 10);
    ctx.strokeStyle = alpha("#000000", 0.12);
    for (let x = 80; x < W; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, pavY + 10);
      ctx.lineTo(x - 20, H);
      ctx.stroke();
    }
    grainRect(ctx, scene, 0, pavY, W, H - pavY, 0.6);

    // Light spill on the wall behind the fascia.
    if (night) {
      const sg = ctx.createRadialGradient(600, 240, 40, 600, 240, 700);
      sg.addColorStop(0, alpha(lighten(brand, 0.5), 0.22));
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    }

    // Glazing frame (window + door).
    const gx = 130, gy = 360, gw = 940, gh = pavY - gy;
    shadowedFill(ctx, () => { ctx.beginPath(); ctx.rect(gx, gy, gw, gh); }, frame, [{ blur: 30, y: 10, color: "rgba(0,0,0,0.35)" }]);
    const glass = (x: number, y: number, w: number, h: number) => {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, night ? "#1d2430" : "#2c333c");
      g.addColorStop(0.5, night ? "#242c38" : "#3d454f");
      g.addColorStop(1, night ? "#151a22" : "#2a3038");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // Interior glow near the floor.
      const ig = ctx.createRadialGradient(x + w / 2, y + h, 10, x + w / 2, y + h, h * 0.9);
      ig.addColorStop(0, alpha(night ? "#ffd9a8" : "#ffe7c2", night ? 0.28 : 0.14));
      ig.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ig;
      ctx.fillRect(x, y, w, h);
      // Reflection streak.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y);
      ctx.lineTo(x + w * 0.42, y);
      ctx.lineTo(x + w * 0.02, y + h);
      ctx.lineTo(x - w * 0.3, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    // Window.
    glass(gx + 18, gy + 18, 560, gh - 36);
    // Mullion.
    ctx.fillStyle = frame;
    ctx.fillRect(gx + 18 + 280, gy + 18, 6, gh - 36);
    // Door (with transom).
    const dx = gx + 620, dw = gw - 620 - 18;
    glass(dx, gy + 18, dw, 110);
    ctx.fillStyle = frame;
    ctx.fillRect(dx, gy + 128, dw, 8);
    glass(dx, gy + 136, dw, gh - 154);
    // Door handle and kick plate.
    const metal = night ? "#8d939c" : "#b9bec5";
    fillRoundRect(ctx, dx + 26, gy + 230, 8, 150, 4, metal);
    ctx.fillStyle = alpha(metal, 0.75);
    ctx.fillRect(dx, gy + gh - 18 - 24, dw, 24);
    // Window vinyl: wordmark.
    const vinyl = pickLogo(scene, "#2d343e", { prefer: "wordmark" });
    drawLogo(ctx, scene, vinyl, rect(gx + 60, gy + 130, 480, 130), { alpha: 0.9, scale: 0.8 });
    drawText(ctx, "OPEN 07–18", gx + 298, gy + 300, { font: font(500, 14, scene.fonts.body), color: "rgba(255,255,255,0.7)", align: "center", letterSpacing: 2.5 });

    // Fascia board with depth.
    const fx = 110, fy = 150, fw = 980, fh = 172;
    shadowedFill(ctx, () => { ctx.beginPath(); ctx.rect(fx, fy, fw, fh); }, darken(brand, 0.4), [{ blur: 40, y: 18, color: "rgba(0,0,0,0.4)" }]);
    // Bottom return face (we look slightly up at it).
    ctx.fillStyle = darken(brand, 0.5);
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh);
    ctx.lineTo(fx + fw, fy + fh);
    ctx.lineTo(fx + fw - 6, fy + fh + 14);
    ctx.lineTo(fx + 6, fy + fh + 14);
    ctx.closePath();
    ctx.fill();
    // Face.
    const face: Quad = [{ x: fx, y: fy }, { x: fx + fw, y: fy }, { x: fx + fw, y: fy + fh }, { x: fx, y: fy + fh }];
    drawFace(ctx, scene, 980, 172, face, (f, w, h) => {
      f.fillStyle = brand;
      f.fillRect(0, 0, w, h);
      // Inner frame line.
      f.strokeStyle = alpha(isDark(brand) ? "#ffffff" : "#000000", 0.18);
      f.lineWidth = 2;
      f.strokeRect(10, 10, w - 20, h - 20);
      const logo = pickLogo(scene, brand, { prefer: "primary", mono: true });
      drawLogo(f, scene, logo, rect(w * 0.2, 28, w * 0.6, h - 56), { scale: 0.95 });
    });
    // Lit gradient across the face.
    const lg = ctx.createLinearGradient(0, fy, 0, fy + fh);
    lg.addColorStop(0, `rgba(255,244,220,${night ? 0.22 : 0.16})`);
    lg.addColorStop(0.5, "rgba(255,244,220,0)");
    lg.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = lg;
    ctx.fillRect(fx, fy, fw, fh);
    // Lamps.
    for (const lx of [300, 600, 900]) {
      lampCone(ctx, lx, fy - 2, fy + fh + 10, 170, night ? 0.26 : 0.12);
      lampHead(ctx, lx, fy - 8, night ? "#0f1113" : "#1f2226");
    }

    // Blade sign projecting from the wall (seen at an angle).
    const bq: Quad = [{ x: 1092, y: 330 }, { x: 1150, y: 338 }, { x: 1150, y: 438 }, { x: 1092, y: 446 }];
    ctx.fillStyle = frame;
    ctx.fillRect(1080, 336, 12, 6);
    ctx.fillRect(1080, 426, 12, 6);
    shadowedFill(ctx, () => { ctx.beginPath(); ctx.moveTo(bq[0].x, bq[0].y); ctx.lineTo(bq[1].x, bq[1].y); ctx.lineTo(bq[2].x, bq[2].y); ctx.lineTo(bq[3].x, bq[3].y); ctx.closePath(); }, brand, [{ blur: 16, y: 6, color: "rgba(0,0,0,0.35)" }]);
    drawFace(ctx, scene, 200, 200, bq, (f, w, h) => {
      f.fillStyle = brand;
      f.fillRect(0, 0, w, h);
      const mark = pickLogo(scene, brand, { prefer: "mark", force: "mark", mono: true });
      drawLogo(f, scene, mark, rect(30, 30, w - 60, h - 60), { scale: 0.9 });
    });
    const bg2 = ctx.createLinearGradient(1092, 0, 1150, 0);
    bg2.addColorStop(0, "rgba(255,255,255,0.10)");
    bg2.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.moveTo(bq[0].x, bq[0].y); ctx.lineTo(bq[1].x, bq[1].y); ctx.lineTo(bq[2].x, bq[2].y); ctx.lineTo(bq[3].x, bq[3].y); ctx.closePath();
    ctx.fill();
  },
};

export const billboard: MockupTemplate = {
  id: "billboard",
  name: "Billboard",
  category: "signage",
  size: { width: 1200, height: 900 },
  description: "Roadside billboard at dusk with lamps and a city silhouette.",
  featured: 9,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    const night = scene.options.theme === "dark";
    const c = scene.colors;
    const brand = brandSurface(scene);
    const horizon = 700;
    const skyTop = night ? mix(isDark(c.secondary) ? c.secondary : "#0d1522", "#070b14", 0.55) : mix("#cfd9e6", scene.options.background ?? "#e8eef5", 0.4);
    const skyBot = night ? mix(c.accent, "#2a1e26", 0.55) : mix("#f6efe4", c.accent, 0.18);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, skyTop);
    sky.addColorStop(1, skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);
    // Sun/moon glow low on the horizon.
    const glow = ctx.createRadialGradient(950, horizon - 40, 10, 950, horizon - 40, 420);
    glow.addColorStop(0, alpha(night ? c.accent : "#fff3d6", night ? 0.35 : 0.7));
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, horizon);
    if (night) {
      const rnd = mulberry32(42);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 90; i++) {
        const x = rnd() * W, y = rnd() * 380, s = 0.6 + rnd() * 1.3;
        ctx.globalAlpha = 0.25 + rnd() * 0.6;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }
    // Skyline silhouettes.
    const layer = (seed: number, baseY: number, maxH: number, color: string) => {
      const rnd = mulberry32(seed);
      ctx.fillStyle = color;
      let x = -20;
      while (x < W + 20) {
        const bw = 26 + rnd() * 80;
        const bh = 20 + rnd() * maxH;
        ctx.fillRect(x, baseY - bh, bw, bh + 4);
        if (rnd() > 0.6) ctx.fillRect(x + bw * 0.3, baseY - bh - 10 - rnd() * 24, 4, 34);
        x += bw + rnd() * 10;
      }
    };
    layer(3, horizon, 150, alpha(night ? "#0b1120" : "#8f9aa8", night ? 0.55 : 0.32));
    layer(8, horizon, 90, alpha(night ? "#0a0e19" : "#6c7684", night ? 0.85 : 0.5));
    // Ground and road.
    ctx.fillStyle = night ? "#191b20" : "#a8a49b";
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = night ? "#2a2d33" : "#6b6e73";
    ctx.fillRect(0, 775, W, H - 775);
    ctx.fillStyle = night ? "#3b3f47" : "#8c8f95";
    ctx.fillRect(0, 775, W, 6);
    ctx.fillStyle = alpha("#ffffff", night ? 0.5 : 0.75);
    for (let x = 30; x < W; x += 130) fillRoundRect(ctx, x, 842, 64, 6, 3, ctx.fillStyle as string);
    grainRect(ctx, scene, 0, 0, W, H, 0.7);

    // Structure.
    const bx = 190, by = 130, bw = 820, bh = 410;
    const steel = night ? "#1b1e23" : "#3a3e44";
    const steelHi = night ? "#2c3038" : "#575c63";
    // Posts.
    for (const px of [400, 774]) {
      const pg = ctx.createLinearGradient(px, 0, px + 28, 0);
      pg.addColorStop(0, steelHi);
      pg.addColorStop(0.5, steel);
      pg.addColorStop(1, darken(steel, 0.4));
      ctx.fillStyle = pg;
      ctx.fillRect(px, by + bh + 20, 28, 775 - by - bh - 20);
      // Post shadow on ground.
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(px + 14, 776, 40, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Catwalk.
    ctx.fillStyle = steel;
    ctx.fillRect(bx - 30, by + bh + 8, bw + 60, 12);
    ctx.fillStyle = steelHi;
    ctx.fillRect(bx - 30, by + bh + 8, bw + 60, 3);
    // Frame with shadow.
    shadowedFill(ctx, () => { ctx.beginPath(); ctx.rect(bx - 16, by - 16, bw + 32, bh + 32); }, steel, [{ blur: 50, y: 24, color: "rgba(0,0,0,0.45)" }]);
    ctx.fillStyle = steelHi;
    ctx.fillRect(bx - 16, by - 16, bw + 32, 3);
    // Light glow behind the board.
    if (night) {
      const g = ctx.createRadialGradient(600, by + bh / 2, 100, 600, by + bh / 2, 720);
      g.addColorStop(0, alpha(lighten(brand, 0.4), 0.18));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Face.
    const face: Quad = [{ x: bx, y: by }, { x: bx + bw, y: by }, { x: bx + bw, y: by + bh }, { x: bx, y: by + bh }];
    const showTag = scene.options.showTagline && !!scene.text.tagline;
    drawFace(ctx, scene, 1640, 820, face, (f, w, h) => {
      f.fillStyle = brand;
      f.fillRect(0, 0, w, h);
      const ink = isDark(brand) ? "#ffffff" : "#111111";
      if (showTag) {
        const logo = pickLogo(scene, brand, { prefer: "primary" });
        drawLogo(f, scene, logo, rect(90, 130, 560, 560), { scale: 0.9 });
        f.fillStyle = alpha(ink, 0.35);
        f.fillRect(730, 150, 2, h - 300);
        const size = fitFontSize(f, scene.text.tagline, scene.fonts.display, 600, 780, 118, 44, -0.01);
        const fontStr = font(600, size, scene.fonts.display);
        const lines = scene.text.tagline.split(" ").length > 2 ? 3 : 2;
        const lh = size * 1.06;
        const yStart = h / 2 - ((lines - 1) * lh) / 2 + size * 0.35;
        const endY = drawParagraph(f, scene.text.tagline, 800, yStart, { font: fontStr, color: ink, maxWidth: 760, lineHeight: lh, maxLines: 3, letterSpacing: -size * 0.01 });
        drawText(f, domainOf(scene), 800, endY + size * 0.2, { font: font(500, 28, scene.fonts.body), color: alpha(ink, 0.7), letterSpacing: 2 });
      } else {
        const logo = pickLogo(scene, brand, { prefer: "primary" });
        drawLogo(f, scene, logo, rect(200, 120, w - 400, h - 240), { scale: 0.9 });
        drawText(f, domainOf(scene), w - 90, h - 70, { font: font(500, 28, scene.fonts.body), color: alpha(ink, 0.7), align: "right", letterSpacing: 2 });
      }
    });
    // Lamps and their light on the face.
    for (const lx of [330, 600, 870]) {
      lampCone(ctx, lx, by - 20, by + bh + 10, 210, night ? 0.28 : 0.12);
      lampHead(ctx, lx, by - 26, night ? "#0d0f12" : "#1e2126");
    }
    const lg = ctx.createLinearGradient(0, by, 0, by + bh);
    lg.addColorStop(0, "rgba(255,244,220,0.10)");
    lg.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = lg;
    ctx.fillRect(bx, by, bw, bh);
  },
};

export const SIGNAGE: MockupTemplate[] = [storefront, billboard];

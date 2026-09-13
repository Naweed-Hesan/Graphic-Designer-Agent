/** Packaging: takeaway coffee cup and a folded box. */
import { alpha, darken, isDark, lighten } from "../color";
import { backdropWithTable, brandSurface, drawFace, drawLogo, drawText, font, greekLines, groundShadow, lightSurface, pickLogo, rect, shadeQuad, shadowedFill, type Ctx } from "../draw";
import { cylinderMap, drawImageContainOnSurface, projectQuad, quadHomography, type Camera, type Quad, type Vec3 } from "../perspective";
import type { MockupTemplate } from "../types";

/** Horizontal cylinder shading (dark edge, highlight left of centre, dark edge). */
function cylShade(ctx: Ctx, x0: number, x1: number, strength = 1): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, `rgba(0,0,0,${0.42 * strength})`);
  g.addColorStop(0.16, `rgba(0,0,0,${0.12 * strength})`);
  g.addColorStop(0.36, `rgba(255,255,255,${0.16 * strength})`);
  g.addColorStop(0.55, "rgba(255,255,255,0)");
  g.addColorStop(0.82, `rgba(0,0,0,${0.16 * strength})`);
  g.addColorStop(1, `rgba(0,0,0,${0.46 * strength})`);
  return g;
}

/**
 * Path of a cone slice between two rim ellipses. The bottom edge is always the front arc; the top edge is
 * the back arc for a full silhouette (cup body, lid) or the front arc for a band wrapped on a body (sleeve).
 */
function bandPath(ctx: Ctx, cx: number, yTop: number, rTop: number, yBot: number, rBot: number, squash: number, topArc: "front" | "back" = "front"): void {
  ctx.beginPath();
  ctx.ellipse(cx, yTop, rTop, rTop * squash, 0, Math.PI, 0, topArc === "front");
  ctx.lineTo(cx + rBot, yBot);
  ctx.ellipse(cx, yBot, rBot, rBot * squash, 0, 0, Math.PI, false);
  ctx.closePath();
}

export const coffeeCup: MockupTemplate = {
  id: "coffee-cup",
  name: "Takeaway cup",
  category: "packaging",
  size: { width: 1200, height: 900 },
  description: "Paper cup with a printed sleeve; the logo wraps around the cylinder.",
  featured: 3,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    const { table } = backdropWithTable(ctx, scene, W, H, 0.7);
    const cx = 600;
    const squash = 0.24;
    const rimY = 200, rimR = 150;
    const botY = 770, botR = 112;
    const rAt = (y: number) => rimR + ((botR - rimR) * (y - rimY)) / (botY - rimY);
    const cupPaper = scene.options.theme === "dark" ? "#f1eee8" : lightSurface(scene);
    const sleeve = brandSurface(scene);
    const lidColor = scene.options.theme === "dark" ? "#1e1f22" : "#f7f5f1";

    // Ground shadow + reflection.
    groundShadow(ctx, cx + 30, botY + botR * squash - 4, 240, 44, isDark(table) ? 0.55 : 0.32);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = cupPaper;
    ctx.beginPath();
    ctx.ellipse(cx, botY + 26, botR * 0.9, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body.
    shadowedFill(ctx, () => bandPath(ctx, cx, rimY + 26, rAt(rimY + 26), botY, botR, squash, "back"), cupPaper, [
      { blur: 60, x: 18, y: 30, color: "rgba(20,16,12,0.22)" },
    ]);
    ctx.save();
    bandPath(ctx, cx, rimY + 26, rAt(rimY + 26), botY, botR, squash, "back");
    ctx.clip();
    ctx.fillStyle = cylShade(ctx, cx - rimR, cx + rimR, 0.9);
    ctx.fillRect(cx - rimR - 2, rimY - 40, rimR * 2 + 4, botY - rimY + 80);
    // Bottom seam.
    ctx.fillStyle = alpha("#000000", 0.14);
    ctx.beginPath();
    ctx.ellipse(cx, botY - 8, botR + 2, (botR + 2) * squash, 0, 0, Math.PI);
    ctx.lineTo(cx - botR - 2, botY + 30);
    ctx.lineTo(cx + botR + 2, botY + 30);
    ctx.closePath();
    ctx.fill();
    // Specular streak on the paper.
    ctx.fillStyle = alpha("#ffffff", 0.22);
    ctx.beginPath();
    ctx.moveTo(cx - rimR * 0.5, rimY + 40);
    ctx.lineTo(cx - rimR * 0.42, rimY + 40);
    ctx.lineTo(cx - botR * 0.42, botY);
    ctx.lineTo(cx - botR * 0.5, botY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sleeve: shadow it casts on the cup, then the band itself.
    const sTop = 330, sBot = 600;
    const rsT = rAt(sTop) + 7, rsB = rAt(sBot) + 7;
    ctx.save();
    bandPath(ctx, cx, rimY + 26, rAt(rimY + 26), botY, botR, squash, "back");
    ctx.clip();
    ctx.filter = "blur(9px)";
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    bandPath(ctx, cx, sTop + 16, rsT, sBot + 16, rsB, squash, "front");
    ctx.fill();
    ctx.restore();
    ctx.save();
    bandPath(ctx, cx, sTop, rsT, sBot, rsB, squash, "front");
    ctx.fillStyle = sleeve;
    ctx.fill();
    ctx.restore();
    // Logo wrapped on the sleeve.
    const logo = pickLogo(scene, sleeve, { prefer: "primary" });
    const lw = logo instanceof HTMLCanvasElement ? logo.width : logo.naturalWidth || 1;
    const lh = logo instanceof HTMLCanvasElement ? logo.height : logo.naturalHeight || 1;
    const aspect = lw / lh;
    const bandH = (sBot - sTop) * 0.5 * scene.options.logoScale;
    const r = (rsT + rsB) / 2;
    const arc = Math.min(1.9, (aspect * bandH) / r); // radians of wrap
    const bh = Math.min((sBot - sTop) * 0.8, (arc * r) / aspect);
    const midY = (sTop + sBot) / 2 + scene.options.logoOffset.y * (sBot - sTop) * 0.6;
    const m = cylinderMap({ cx, top: midY - bh / 2, bottom: midY + bh / 2, rTop: rAt(midY - bh / 2) + 8, rBottom: rAt(midY + bh / 2) + 8, squash, angle: arc, angleCenter: scene.options.logoOffset.x * 1.2 });
    ctx.save();
    bandPath(ctx, cx, sTop, rsT, sBot, rsB, squash, "front");
    ctx.clip();
    drawImageContainOnSurface(ctx, logo, m, (arc * r) / bh, rect(0, 0, 1, 1), { mesh: { cols: 24, rows: 6 } });
    // Sleeve shading over the logo + a soft seam line.
    ctx.fillStyle = cylShade(ctx, cx - rsT, cx + rsT, 1);
    ctx.fillRect(cx - rsT - 4, sTop - 60, rsT * 2 + 8, sBot - sTop + 120);
    ctx.fillStyle = alpha("#ffffff", 0.14);
    ctx.fillRect(cx - rsT - 4, sTop - 60, rsT * 2 + 8, 1);
    ctx.restore();
    // Sleeve edges: light corrugated lip on top, darker fold at the bottom.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, sTop + 1.5, rsT, rsT * squash, 0, 0, Math.PI, false);
    ctx.strokeStyle = alpha(lighten(sleeve, 0.5), 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, sBot - 1.5, rsB, rsB * squash, 0, 0, Math.PI, false);
    ctx.strokeStyle = alpha(darken(sleeve, 0.5), 0.45);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Lid: skirt band, then dome.
    const lidR = rimR + 10;
    const skirtTop = rimY - 4, skirtBot = rimY + 30;
    shadowedFill(ctx, () => bandPath(ctx, cx, skirtTop, lidR, skirtBot, lidR - 2, squash, "back"), lidColor, [{ blur: 10, y: 4, color: "rgba(0,0,0,0.25)" }]);
    ctx.save();
    bandPath(ctx, cx, skirtTop, lidR, skirtBot, lidR - 2, squash, "back");
    ctx.clip();
    ctx.fillStyle = cylShade(ctx, cx - lidR, cx + lidR, 1.1);
    ctx.fillRect(cx - lidR, skirtTop - 40, lidR * 2, 120);
    ctx.restore();
    // Lid top surface.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, skirtTop, lidR, lidR * squash, 0, 0, Math.PI * 2);
    ctx.fillStyle = lighten(lidColor, isDark(lidColor) ? 0.12 : 0.03);
    ctx.fill();
    ctx.strokeStyle = alpha(isDark(lidColor) ? "#ffffff" : "#000000", 0.14);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Dome.
    const domeR = lidR * 0.64;
    const domeTop = skirtTop - 18;
    ctx.beginPath();
    ctx.ellipse(cx, domeTop, domeR, domeR * squash, 0, Math.PI, Math.PI * 2, false);
    ctx.lineTo(cx + domeR, skirtTop);
    ctx.ellipse(cx, skirtTop, domeR, domeR * squash, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = lidColor;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = cylShade(ctx, cx - domeR, cx + domeR, 0.9);
    ctx.fillRect(cx - domeR, domeTop - 40, domeR * 2, 100);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(cx, domeTop, domeR, domeR * squash, 0, 0, Math.PI * 2);
    ctx.fillStyle = lighten(lidColor, isDark(lidColor) ? 0.16 : 0.05);
    ctx.fill();
    ctx.strokeStyle = alpha(isDark(lidColor) ? "#ffffff" : "#000000", 0.16);
    ctx.stroke();
    // Sip hole.
    ctx.beginPath();
    ctx.ellipse(cx + domeR * 0.42, domeTop + 4, 16, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = alpha("#000000", isDark(lidColor) ? 0.8 : 0.55);
    ctx.fill();
    ctx.restore();
  },
};

export const packagingBox: MockupTemplate = {
  id: "packaging-box",
  name: "Product box",
  category: "packaging",
  size: { width: 1200, height: 900 },
  description: "Folded carton in three-quarter view with the logo on two faces.",
  featured: 6,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    const { table } = backdropWithTable(ctx, scene, W, H, 0.6);
    const cam: Camera = { cx: W / 2 + 10, cy: H * 0.5, focal: 3400, distance: 3400, rotX: 0.3, rotY: -0.62, scale: 1.14 };
    const w = 300, h = 380, d = 210;
    const box = brandSurface(scene);
    const P = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
    const front = projectQuad([P(-w / 2, h / 2, d / 2), P(w / 2, h / 2, d / 2), P(w / 2, -h / 2, d / 2), P(-w / 2, -h / 2, d / 2)], cam);
    const side = projectQuad([P(w / 2, h / 2, d / 2), P(w / 2, h / 2, -d / 2), P(w / 2, -h / 2, -d / 2), P(w / 2, -h / 2, d / 2)], cam);
    const top = projectQuad([P(-w / 2, h / 2, -d / 2), P(w / 2, h / 2, -d / 2), P(w / 2, h / 2, d / 2), P(-w / 2, h / 2, d / 2)], cam);
    const bottom = projectQuad([P(-w / 2, -h / 2, -d / 2), P(w / 2, -h / 2, -d / 2), P(w / 2, -h / 2, d / 2), P(-w / 2, -h / 2, d / 2)], cam);

    // Ground shadow: blurred footprint, offset to the right.
    ctx.save();
    ctx.filter = "blur(18px)";
    ctx.fillStyle = `rgba(15,12,10,${isDark(table) ? 0.6 : 0.34})`;
    const sh: Quad = bottom.map((p) => ({ x: p.x + 26, y: p.y + 10 })) as Quad;
    ctx.beginPath();
    ctx.moveTo(sh[0].x - 20, sh[0].y);
    ctx.lineTo(sh[1].x + 40, sh[1].y);
    ctx.lineTo(sh[2].x + 40, sh[2].y + 14);
    ctx.lineTo(sh[3].x - 20, sh[3].y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.filter = "blur(4px)";
    ctx.fillStyle = "rgba(15,12,10,0.35)";
    ctx.beginPath();
    ctx.moveTo(bottom[0].x, bottom[0].y);
    ctx.lineTo(bottom[1].x, bottom[1].y);
    ctx.lineTo(bottom[2].x, bottom[2].y);
    ctx.lineTo(bottom[3].x, bottom[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const light = isDark(box) ? "#ffffff" : "#000000";
    // Front face.
    drawFace(ctx, scene, 600, 760, front, (f, fw, fh) => {
      f.fillStyle = box;
      f.fillRect(0, 0, fw, fh);
      const logo = pickLogo(scene, box, { prefer: "primary" });
      drawLogo(f, scene, logo, rect(fw * 0.14, fh * 0.2, fw * 0.72, fh * 0.42), { scale: 0.95 });
      if (scene.options.showTagline && scene.text.tagline) {
        drawText(f, scene.text.tagline, fw / 2, fh * 0.76, { font: font(400, 24, scene.fonts.display, true), color: alpha(light, 0.85), align: "center", maxWidth: fw * 0.8 });
      }
      f.fillStyle = alpha(light, 0.5);
      f.fillRect(fw * 0.42, fh * 0.86, fw * 0.16, 1.5);
      drawText(f, "NET 250 g · 8.8 oz", fw / 2, fh * 0.92, { font: font(500, 13, scene.fonts.body), color: alpha(light, 0.6), align: "center", letterSpacing: 1.2 });
      // Lid fold line.
      f.fillStyle = alpha("#000000", 0.16);
      f.fillRect(0, fh * 0.12, fw, 2);
      f.fillStyle = alpha("#ffffff", 0.12);
      f.fillRect(0, fh * 0.12 + 2, fw, 1.5);
    });
    // Side face.
    drawFace(ctx, scene, 420, 760, side, (f, fw, fh) => {
      f.fillStyle = box;
      f.fillRect(0, 0, fw, fh);
      const mark = pickLogo(scene, box, { prefer: "mark", force: "mark" });
      drawLogo(f, scene, mark, rect(fw * 0.3, fh * 0.06, fw * 0.4, fh * 0.18), { scale: 0.75 });
      drawText(f, scene.text.name.toUpperCase(), fw / 2, fh * 0.34, { font: font(600, 15, scene.fonts.body), color: alpha(light, 0.9), align: "center", letterSpacing: 2.4, maxWidth: fw * 0.86 });
      greekLines(f, fw * 0.14, fh * 0.42, fw * 0.72, 7, { lineHeight: 16, thickness: 5, color: alpha(light, 0.28), seed: 13, paragraphEvery: 4 });
      greekLines(f, fw * 0.14, fh * 0.66, fw * 0.72, 4, { lineHeight: 16, thickness: 5, color: alpha(light, 0.22), seed: 17, paragraphEvery: 9 });
      // Barcode.
      const bx = fw * 0.3, by = fh * 0.82, bw = fw * 0.4, bh2 = fh * 0.08;
      f.fillStyle = alpha(light, 0.9);
      let x = bx;
      let i = 0;
      while (x < bx + bw) {
        const wdt = 1.5 + ((i * 7) % 4);
        if (i % 2 === 0) f.fillRect(x, by, wdt, bh2);
        x += wdt + 1.5;
        i++;
      }
      f.fillStyle = alpha("#000000", 0.16);
      f.fillRect(0, fh * 0.12, fw, 2);
    });
    // Top face.
    drawFace(ctx, scene, 600, 420, top, (f, fw, fh) => {
      f.fillStyle = box;
      f.fillRect(0, 0, fw, fh);
      const mark = pickLogo(scene, box, { prefer: "mark", force: "mark" });
      drawLogo(f, scene, mark, rect(fw * 0.38, fh * 0.28, fw * 0.24, fh * 0.44), { scale: 0.8 });
      // Tuck flap seam across the top.
      f.fillStyle = alpha("#000000", 0.14);
      f.fillRect(0, fh * 0.5 - 1, fw, 2);
      f.fillStyle = alpha("#ffffff", 0.1);
      f.fillRect(0, fh * 0.5 + 1, fw, 1.5);
    });

    // Lighting per face.
    shadeQuad(ctx, top, "rgba(255,255,255,0.16)");
    shadeQuad(ctx, side, "rgba(0,0,0,0.30)");
    const fm = quadHomography(front);
    const fa = fm(0, 0), fb = fm(1, 1);
    shadeQuad(ctx, front, (() => {
      const g = ctx.createLinearGradient(fa.x, fa.y, fb.x, fb.y);
      g.addColorStop(0, "rgba(255,255,255,0.10)");
      g.addColorStop(1, "rgba(0,0,0,0.12)");
      return g;
    })());
    // Ambient occlusion where the side meets the ground and the front edge highlight.
    const sm = quadHomography(side);
    const s0 = sm(0, 1), s1 = sm(0, 0);
    shadeQuad(ctx, side, (() => {
      const g = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
      g.addColorStop(0, "rgba(0,0,0,0.22)");
      g.addColorStop(0.35, "rgba(0,0,0,0)");
      return g;
    })());
    ctx.save();
    ctx.strokeStyle = alpha(lighten(box, 0.5), 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(front[1].x, front[1].y);
    ctx.lineTo(front[2].x, front[2].y);
    ctx.moveTo(front[0].x, front[0].y);
    ctx.lineTo(front[1].x, front[1].y);
    ctx.lineTo(side[1].x, side[1].y);
    ctx.stroke();
    ctx.restore();
  },
};

export const PACKAGING: MockupTemplate[] = [coffeeCup, packagingBox];

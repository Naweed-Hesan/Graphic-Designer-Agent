/** Apparel: cotton tote bag with a one-colour print. */
import { alpha, darken, isDark, lighten, mix } from "../color";
import { backdrop, brandSurface, groundShadow, grainRect, pickLogo, shadowedFill, type Ctx } from "../draw";
import { applyWeave } from "../noise";
import { drawImageContainOnSurface, type SurfaceMap } from "../perspective";
import type { MockupTemplate } from "../types";

function bodyPath(ctx: Ctx, cx: number, top: number, bottom: number, halfTop: number, halfBot: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - halfTop, top);
  ctx.lineTo(cx + halfTop, top);
  ctx.lineTo(cx + halfBot, bottom - r);
  ctx.quadraticCurveTo(cx + halfBot, bottom, cx + halfBot - r, bottom);
  ctx.lineTo(cx - halfBot + r, bottom);
  ctx.quadraticCurveTo(cx - halfBot, bottom, cx - halfBot, bottom - r);
  ctx.closePath();
}

function handlePath(ctx: Ctx, cx: number, spread: number, y: number, apex: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - spread, y);
  ctx.bezierCurveTo(cx - spread, apex, cx + spread, apex, cx + spread, y);
}

export const toteBag: MockupTemplate = {
  id: "tote-bag",
  name: "Tote bag",
  category: "apparel",
  size: { width: 1200, height: 900 },
  description: "Natural cotton tote with a screen-printed one-colour logo.",
  featured: 5,
  render(ctx, scene) {
    const { width: W, height: H } = this.size;
    backdrop(ctx, scene, W, H);
    const dark = scene.options.theme === "dark";
    const fabric = dark ? mix(brandSurface(scene), "#1d1f23", 0.25) : mix("#ebe4d4", scene.colors.background, 0.3);
    const seam = dark ? lighten(fabric, 0.18) : darken(fabric, 0.22);
    const cx = 600, top = 300, bottom = 840, halfTop = 250, halfBot = 268, r = 42;

    groundShadow(ctx, cx, bottom + 6, 320, 40, isDark(fabric) ? 0.5 : 0.35);

    // Back handle.
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 30;
    ctx.strokeStyle = darken(fabric, 0.16);
    handlePath(ctx, cx, 118, top + 4, 40);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = alpha(seam, 0.5);
    ctx.setLineDash([5, 5]);
    handlePath(ctx, cx, 118, top + 4, 40);
    ctx.stroke();
    ctx.restore();

    // Body.
    shadowedFill(ctx, () => bodyPath(ctx, cx, top, bottom, halfTop, halfBot, r), fabric, [
      { blur: 70, x: 10, y: 40, color: "rgba(20,16,12,0.22)" },
      { blur: 12, y: 6, color: "rgba(20,16,12,0.16)" },
    ]);
    ctx.save();
    bodyPath(ctx, cx, top, bottom, halfTop, halfBot, r);
    ctx.clip();
    // Vertical light falloff and side shading.
    const vg = ctx.createLinearGradient(0, top, 0, bottom);
    vg.addColorStop(0, "rgba(255,255,255,0.10)");
    vg.addColorStop(0.6, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, top, W, bottom - top);
    const hg = ctx.createLinearGradient(cx - halfBot, 0, cx + halfBot, 0);
    hg.addColorStop(0, "rgba(0,0,0,0.16)");
    hg.addColorStop(0.12, "rgba(0,0,0,0)");
    hg.addColorStop(0.5, "rgba(255,255,255,0.05)");
    hg.addColorStop(0.88, "rgba(0,0,0,0)");
    hg.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, top, W, bottom - top);
    // Soft creases.
    for (const [fx, fw, s] of [[cx - 140, 90, 0.05], [cx + 60, 70, 0.045], [cx + 190, 60, 0.04]] as [number, number, number][]) {
      const cg = ctx.createLinearGradient(fx, 0, fx + fw, 0);
      cg.addColorStop(0, "rgba(0,0,0,0)");
      cg.addColorStop(0.45, `rgba(0,0,0,${s})`);
      cg.addColorStop(0.55, `rgba(255,255,255,${s})`);
      cg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(fx, top + 60, fw, bottom - top);
    }
    // Hem.
    ctx.fillStyle = alpha("#000000", 0.06);
    ctx.fillRect(0, top, W, 28);
    ctx.strokeStyle = alpha(seam, 0.55);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - halfTop, top + 20);
    ctx.lineTo(cx + halfTop, top + 20);
    ctx.stroke();
    ctx.setLineDash([]);
    // Bottom seam.
    ctx.strokeStyle = alpha(seam, 0.4);
    ctx.beginPath();
    ctx.moveTo(cx - halfBot + 10, bottom - 24);
    ctx.lineTo(cx + halfBot - 10, bottom - 24);
    ctx.stroke();

    // Print, warped with a gentle bulge, bedded into the weave.
    const area = { x: cx - 205, y: top + 120, w: 410, h: 330 };
    const map: SurfaceMap = (u, v) => ({
      x: area.x + u * area.w + (u - 0.5) * v * 22,
      y: area.y + v * area.h + Math.sin(Math.PI * u) * 12 * (1 - v * 0.4),
    });
    const logo = pickLogo(scene, fabric, { prefer: "primary", mono: true });
    const o = scene.options;
    ctx.globalAlpha = 0.92;
    drawImageContainOnSurface(ctx, logo, map, area.w / area.h, { x: 0, y: 0, w: 1, h: 1 }, { scale: o.logoScale, offset: o.logoOffset, mesh: { cols: 14, rows: 12 } });
    ctx.globalAlpha = 1;
    applyWeave(ctx, 0, top, W, bottom - top, dark ? 0.3 : 0.42);
    grainRect(ctx, scene, 0, top, W, bottom - top, 0.8);
    ctx.restore();

    // Front handle + patches.
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 30;
    ctx.strokeStyle = mix(fabric, "#000000", 0.05);
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    handlePath(ctx, cx, 150, top + 44, 60);
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 22;
    ctx.strokeStyle = mix(fabric, "#ffffff", dark ? 0.02 : 0.06);
    handlePath(ctx, cx, 150, top + 44, 60);
    ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = alpha(seam, 0.5);
    ctx.setLineDash([5, 5]);
    handlePath(ctx, cx, 150, top + 44, 60);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const px of [cx - 150, cx + 150]) {
      ctx.fillStyle = mix(fabric, "#000000", 0.08);
      ctx.beginPath();
      ctx.roundRect(px - 19, top + 10, 38, 50, 4);
      ctx.fill();
      ctx.strokeStyle = alpha(seam, 0.55);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - 13, top + 16);
      ctx.lineTo(px + 13, top + 54);
      ctx.moveTo(px + 13, top + 16);
      ctx.lineTo(px - 13, top + 54);
      ctx.stroke();
      ctx.strokeRect(px - 15, top + 14, 30, 42);
    }
    ctx.restore();
  },
};

export const APPAREL: MockupTemplate[] = [toteBag];

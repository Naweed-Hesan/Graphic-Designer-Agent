/** Isomorphic contrast helpers: WCAG 2.x ratio and APCA Lc. */
import { calcAPCA } from "apca-w3";

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcagRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

export function apcaLc(fg: string, bg: string): number {
  const v = calcAPCA(fg, bg);
  return typeof v === "number" ? v : Number(v);
}

export interface ContrastReport {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  apca: number;
  /** Plain-language APCA guidance */
  apcaUse: string;
}

export function contrastReport(fg: string, bg: string): ContrastReport {
  const ratio = wcagRatio(fg, bg);
  const apca = apcaLc(fg, bg);
  const abs = Math.abs(apca);
  const apcaUse =
    abs >= 90 ? "Body text at any size" : abs >= 75 ? "Body text ≥ 15px" : abs >= 60 ? "Large text / headlines ≥ 24px" : abs >= 45 ? "Large bold headlines, UI elements" : abs >= 30 ? "Non-text, decorative only" : "Insufficient for text";
  return {
    ratio: Math.round(ratio * 100) / 100,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    apca: Math.round(apca * 10) / 10,
    apcaUse,
  };
}

/** Choose black or white text for a background. */
export function bestTextOn(bg: string): "#000000" | "#ffffff" {
  return wcagRatio("#000000", bg) >= wcagRatio("#ffffff", bg) ? "#000000" : "#ffffff";
}

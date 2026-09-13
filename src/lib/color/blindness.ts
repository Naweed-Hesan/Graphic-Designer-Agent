/**
 * Colour-vision deficiency simulation. Uses the Machado, Oliveira & Fernandes
 * (2009) matrices at full severity, applied in linear sRGB. Achromatopsia is
 * modelled as luminance only (Rec. 709 weights).
 */
import { hexToRgb, rgbToHex } from "./contrast";

export type DeficiencyType = "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

export const DEFICIENCIES: { id: DeficiencyType; label: string; short: string; note: string }[] = [
  { id: "protanopia", label: "Protanopia", short: "Prot", note: "No red cones · ~1% of men" },
  { id: "deuteranopia", label: "Deuteranopia", short: "Deut", note: "No green cones · ~1% of men, most common" },
  { id: "tritanopia", label: "Tritanopia", short: "Trit", note: "No blue cones · rare" },
  { id: "achromatopsia", label: "Achromatopsia", short: "Mono", note: "No colour vision · very rare" },
];

type Matrix = [[number, number, number], [number, number, number], [number, number, number]];

const MATRICES: Record<Exclude<DeficiencyType, "achromatopsia">, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function toLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function fromLinear(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return s * 255;
}

/** Simulate how `hex` is perceived with the given deficiency. Returns a hex. */
export function simulate(hex: string, type: DeficiencyType): string {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);
  if (type === "achromatopsia") {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const v = fromLinear(y);
    return rgbToHex(v, v, v);
  }
  const m = MATRICES[type];
  const rr = m[0][0] * r + m[0][1] * g + m[0][2] * b;
  const gg = m[1][0] * r + m[1][1] * g + m[1][2] * b;
  const bb = m[2][0] * r + m[2][1] * g + m[2][2] * b;
  return rgbToHex(fromLinear(rr), fromLinear(gg), fromLinear(bb));
}

export function simulatePalette(hexes: string[], type: DeficiencyType): string[] {
  return hexes.map((h) => simulate(h, type));
}

import { describe, it, expect } from "vitest";
import { wcagRatio, contrastReport, bestTextOn, hexToRgb, rgbToHex } from "../contrast";

describe("contrast", () => {
  it("black on white is 21:1 and passes everything", () => {
    expect(wcagRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    const r = contrastReport("#000000", "#ffffff");
    expect(r.aaaNormal).toBe(true);
    expect(Math.abs(r.apca)).toBeGreaterThan(100);
  });
  it("grey on grey fails AA", () => {
    expect(contrastReport("#777777", "#888888").aaLarge).toBe(false);
  });
  it("picks readable text colour", () => {
    expect(bestTextOn("#0B1B2B")).toBe("#ffffff");
    expect(bestTextOn("#F4F1EA")).toBe("#000000");
  });
  it("round-trips hex", () => {
    expect(rgbToHex(...hexToRgb("#0f7b6c"))).toBe("#0f7b6c");
  });
});

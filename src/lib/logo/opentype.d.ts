/**
 * Minimal typings for opentype.js v2 (the package ships no .d.ts).
 * Only the surface used by the wordmark outliner is declared.
 */
declare module "opentype.js" {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  export interface Path {
    commands: unknown[];
    fill: string | null;
    stroke: string | null;
    strokeWidth: number;
    /** A number is treated as decimalPlaces (with flipY disabled). */
    toPathData(options?: number | { decimalPlaces?: number; optimize?: boolean; flipY?: boolean }): string;
    toSVG(options?: number | { decimalPlaces?: number }): string;
    getBoundingBox(): BoundingBox;
  }
  export interface GlyphRenderOptions {
    kerning?: boolean;
    /** In em units — multiplied by fontSize. */
    letterSpacing?: number;
    tracking?: number;
    features?: Record<string, boolean>;
    hinting?: boolean;
    script?: string;
    language?: string;
  }
  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    names: Record<string, Record<string, string>>;
    getPath(text: string, x: number, y: number, fontSize: number, options?: GlyphRenderOptions): Path;
    getAdvanceWidth(text: string, fontSize: number, options?: GlyphRenderOptions): number;
    hasChar(c: string): boolean;
  }
  export function parse(buffer: ArrayBuffer, options?: Record<string, unknown>): Font;
  const opentype: { parse: typeof parse } | undefined;
  export default opentype;
}

declare module "apca-w3" {
  export function calcAPCA(textColor: string | number[], bgColor: string | number[], places?: number, round?: boolean): number | string;
  export function sRGBtoY(rgb: number[]): number;
  export function APCAcontrast(txtY: number, bgY: number, places?: number): number | string;
  export function fontLookupAPCA(contrast: number, places?: number): number[];
}
declare module "imagetracerjs" {
  interface ImageTracerOptions {
    ltres?: number; qtres?: number; pathomit?: number; rightangleenhance?: boolean;
    colorsampling?: number; numberofcolors?: number; mincolorratio?: number; colorquantcycles?: number;
    layering?: number; strokewidth?: number; linefilter?: boolean; scale?: number; roundcoords?: number;
    viewbox?: boolean; desc?: boolean; lcpr?: number; qcpr?: number; blurradius?: number; blurdelta?: number;
    pal?: { r: number; g: number; b: number; a: number }[];
  }
  const ImageTracer: {
    imagedataToSVG(imgd: ImageData, options?: ImageTracerOptions | string): string;
    imageToSVG(url: string, callback: (svg: string) => void, options?: ImageTracerOptions | string): void;
    imagedataToTracedata(imgd: ImageData, options?: ImageTracerOptions | string): unknown;
    optionpresets: Record<string, ImageTracerOptions>;
  };
  export default ImageTracer;
}
declare module "gifenc" {
  export function GIFEncoder(): { writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; repeat?: number; first?: boolean }): void; finish(): void; bytes(): Uint8Array; bytesView(): Uint8Array };
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: "rgb565" | "rgb444" | "rgba4444"): Uint8Array;
  export function nearestColorIndex(palette: number[][], pixel: number[]): number;
}

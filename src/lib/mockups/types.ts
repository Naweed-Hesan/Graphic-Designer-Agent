/** Scene/template contracts for the procedural mockup renderer (no React). */
import type { Genome } from "@/lib/genome/schema";
import type { Point } from "./perspective";

export type MockupCategory = "stationery" | "apparel" | "signage" | "packaging" | "digital" | "social" | "print";

export const CATEGORY_LABELS: Record<MockupCategory, string> = {
  stationery: "Stationery",
  apparel: "Apparel",
  signage: "Signage",
  packaging: "Packaging",
  digital: "Digital",
  social: "Social",
  print: "Print",
};

export const CATEGORY_ORDER: MockupCategory[] = ["stationery", "packaging", "signage", "apparel", "digital", "social", "print"];

/** Any pre-rasterised artwork we can draw. */
export type Drawable = HTMLImageElement | HTMLCanvasElement;

export type LogoKind = "primary" | "mark" | "wordmark";
export type LogoVariantChoice = "auto" | LogoKind | "mono";

export interface SceneLogos {
  primary: Drawable;
  mark: Drawable;
  wordmark: Drawable;
  /** One-colour versions of the primary lockup (project variants when present, silhouettes otherwise). */
  monoDark: Drawable;
  monoLight: Drawable;
  /** One-colour versions of every kind, for coloured surfaces. */
  mono: Record<LogoKind, { light: Drawable; dark: Drawable }>;
  /** True when no logo artwork exists in the project and generated placeholders are shown. */
  placeholder: boolean;
}

export interface SceneColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  neutral: string;
}

export interface SceneOptions {
  /** Multiplier applied to each template's default logo size (0.5–1.6). */
  logoScale: number;
  /** Offset as a fraction of the logo area (-0.5..0.5). */
  logoOffset: Point;
  variant: LogoVariantChoice;
  /** Swap light/dark one-colour logos. */
  invert: boolean;
  theme: "light" | "dark";
  /** Backdrop / environment colour override (hex). */
  background?: string;
  showTagline: boolean;
  /** Grain intensity 0–1. */
  grain: number;
}

export interface MockupScene {
  genome: Genome;
  logos: SceneLogos;
  colors: SceneColors;
  /** CSS font-family stacks. */
  fonts: { display: string; body: string };
  text: { name: string; tagline: string; positioning: string };
  options: SceneOptions;
  /** Device pixel ratio of the current render (thumbnails < 1, previews 2). */
  pixelRatio: number;
}

export interface MockupTemplate {
  id: string;
  name: string;
  category: MockupCategory;
  /** Size at 1×; renders are scaled from these units. */
  size: { width: number; height: number };
  description: string;
  /** Lower = earlier on the presentation board. */
  featured?: number;
  render: (ctx: CanvasRenderingContext2D, scene: MockupScene) => void;
}

export const DEFAULT_OPTIONS: SceneOptions = {
  logoScale: 1,
  logoOffset: { x: 0, y: 0 },
  variant: "auto",
  invert: false,
  theme: "light",
  background: undefined,
  showTagline: true,
  grain: 0.5,
};

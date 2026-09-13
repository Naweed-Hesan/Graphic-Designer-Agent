import type { StageId } from "./schema";

export interface StageDef {
  id: StageId;
  label: string;
  short: string;
  description: string;
  /** lucide icon name, resolved in the UI */
  icon: "FileText" | "Compass" | "PenTool" | "Palette" | "Type" | "Image" | "Clapperboard" | "Layers" | "BookOpen" | "PackageOpen";
}

export const STAGES: StageDef[] = [
  { id: "brief", label: "Brief", short: "01", description: "Capture the client, goals, audience and deliverables.", icon: "FileText" },
  { id: "strategy", label: "Strategy", short: "02", description: "Positioning, values, archetype, personality, tone and tagline.", icon: "Compass" },
  { id: "logo", label: "Logo", short: "03", description: "Concepts, vectorisation, wordmark, lockups, clearspace and exports.", icon: "PenTool" },
  { id: "color", label: "Color", short: "04", description: "Palette generation, harmony, accessibility and tints.", icon: "Palette" },
  { id: "type", label: "Type", short: "05", description: "Font pairing, type scale and specimens from Google Fonts.", icon: "Type" },
  { id: "imagery", label: "Imagery", short: "06", description: "On-brand image generation, editing and style references.", icon: "Image" },
  { id: "motion", label: "Motion", short: "07", description: "Logo animation presets and AI video, exported as MP4/WebM/GIF.", icon: "Clapperboard" },
  { id: "mockups", label: "Mockups", short: "08", description: "See the identity applied to cards, signage, social and packaging.", icon: "Layers" },
  { id: "guidelines", label: "Guidelines", short: "09", description: "Auto-generated brand guidelines, always in sync.", icon: "BookOpen" },
  { id: "export", label: "Export", short: "10", description: "Brand kit ZIP, design tokens, CSS, Tailwind, ASE and more.", icon: "PackageOpen" },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, StageDef>;

export function nextStage(id: StageId): StageId | null {
  const i = STAGES.findIndex((s) => s.id === id);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].id : null;
}
export function prevStage(id: StageId): StageId | null {
  const i = STAGES.findIndex((s) => s.id === id);
  return i > 0 ? STAGES[i - 1].id : null;
}

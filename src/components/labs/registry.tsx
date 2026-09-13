"use client";
import dynamic from "next/dynamic";
import type { StageId } from "@/lib/genome/schema";
import { Spinner } from "@/components/ui";

const loading = () => (
  <div className="flex items-center justify-center h-64 text-fg-muted gap-2">
    <Spinner /> Loading lab…
  </div>
);

/** Labs are code-split so heavy ones (vectoriser, video encoder) load on demand. */
const LABS: Record<StageId, React.ComponentType> = {
  brief: dynamic(() => import("./brief/BriefLab").then((m) => m.BriefLab), { loading }),
  strategy: dynamic(() => import("./strategy/StrategyLab").then((m) => m.StrategyLab), { loading }),
  logo: dynamic(() => import("./logo/LogoLab").then((m) => m.LogoLab), { loading }),
  color: dynamic(() => import("./color/ColorLab").then((m) => m.ColorLab), { loading }),
  type: dynamic(() => import("./type/TypeLab").then((m) => m.TypeLab), { loading }),
  imagery: dynamic(() => import("./imagery/ImageryLab").then((m) => m.ImageryLab), { loading }),
  motion: dynamic(() => import("./motion/MotionLab").then((m) => m.MotionLab), { loading }),
  mockups: dynamic(() => import("./mockups/MockupLab").then((m) => m.MockupLab), { loading }),
  guidelines: dynamic(() => import("./guidelines/GuidelinesLab").then((m) => m.GuidelinesLab), { loading }),
  export: dynamic(() => import("./export/ExportLab").then((m) => m.ExportLab), { loading }),
};

export function StageView({ stage }: { stage: StageId }) {
  const Lab = LABS[stage];
  return <Lab />;
}

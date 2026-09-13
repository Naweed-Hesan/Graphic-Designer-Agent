"use client";
import { PageHeader, EmptyState } from "@/components/ui";
import { STAGE_BY_ID } from "@/lib/genome/stages";
import type { StageId } from "@/lib/genome/schema";
import { Hammer } from "lucide-react";

/** Temporary placeholder while a lab is being built. */
export function LabScaffold({ stage }: { stage: StageId }) {
  const def = STAGE_BY_ID[stage];
  return (
    <div>
      <PageHeader eyebrow={`Stage ${def.short}`} title={def.label} description={def.description} />
      <EmptyState icon={<Hammer className="h-8 w-8" />} title={`${def.label} lab is under construction`} description="This lab is being implemented." />
    </div>
  );
}

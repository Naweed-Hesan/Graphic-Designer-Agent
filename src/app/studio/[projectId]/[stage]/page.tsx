import { notFound } from "next/navigation";
import { StageId } from "@/lib/genome/schema";
import { StageView } from "@/components/labs/registry";

export default async function StagePage({ params }: { params: Promise<{ projectId: string; stage: string }> }) {
  const { stage } = await params;
  const parsed = StageId.safeParse(stage);
  if (!parsed.success) notFound();
  return <StageView stage={parsed.data} />;
}

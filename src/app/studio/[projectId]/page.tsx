import { redirect } from "next/navigation";

export default async function StudioIndex({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/studio/${projectId}/brief`);
}

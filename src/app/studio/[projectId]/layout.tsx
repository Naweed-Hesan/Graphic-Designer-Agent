import { StudioShell } from "@/components/shell/StudioShell";

export default async function StudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <StudioShell projectId={projectId}>{children}</StudioShell>;
}

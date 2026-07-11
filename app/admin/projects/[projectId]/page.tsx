import { AdminSectionPage } from "@/components/admin/AdminSectionPage";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AdminSectionPage eyebrow={`Project ${projectId}`} title="Project Workspace" icon="calendar" />;
}

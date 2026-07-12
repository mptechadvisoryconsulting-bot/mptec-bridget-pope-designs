import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AdminResourcePage eyebrow={`Project ${projectId}`} title="Project Workspace" table="projects" detailId={projectId} actionHref="/admin/invoices" actionLabel="Create Invoice" />;
}

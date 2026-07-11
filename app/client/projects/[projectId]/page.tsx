import { ClientSectionPage } from "@/components/client/ClientSectionPage";

export default async function ClientProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ClientSectionPage eyebrow={`Project ${projectId}`} title="Project Workspace" />;
}

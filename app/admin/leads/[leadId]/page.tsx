import { AdminSectionPage } from "@/components/admin/AdminSectionPage";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <AdminSectionPage eyebrow={`Lead ${leadId}`} title="Lead Workspace" icon="people" />;
}

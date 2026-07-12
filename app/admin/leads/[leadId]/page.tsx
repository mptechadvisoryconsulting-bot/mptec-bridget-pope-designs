import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <AdminResourcePage eyebrow={`Lead ${leadId}`} title="Lead Workspace" table="leads" detailId={leadId} actionHref="/admin/consultations" actionLabel="Schedule Consultation" />;
}

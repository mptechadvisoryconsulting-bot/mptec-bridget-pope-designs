import { AdminSectionPage } from "@/components/admin/AdminSectionPage";

export default async function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return <AdminSectionPage eyebrow={`Proposal ${proposalId}`} title="Proposal Detail" icon="proposal" />;
}

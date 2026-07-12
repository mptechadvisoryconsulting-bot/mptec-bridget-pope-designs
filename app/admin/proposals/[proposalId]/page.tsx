import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default async function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return <AdminResourcePage eyebrow={`Proposal ${proposalId}`} title="Proposal Detail" table="proposals" detailId={proposalId} actionHref="/admin/invoices" actionLabel="Create Invoice" />;
}

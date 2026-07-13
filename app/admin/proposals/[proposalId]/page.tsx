import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default async function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;

  return (
    <AdminWorkspacePage
      eyebrow="Sales"
      title="Proposal Detail"
      description="Proposal financials and approval state before contract, invoice, and deposit collection."
      table="proposals"
      detailId={proposalId}
      actionHref="/admin/invoices"
      actionLabel="Create Invoice"
      columns={[
        { key: "proposal_number", label: "Proposal" },
        { key: "title", label: "Title" },
        { key: "introduction", label: "Intro" },
        { key: "subtotal", label: "Subtotal", format: "currency" },
        { key: "discount_amount", label: "Discount", format: "currency" },
        { key: "tax_amount", label: "Tax", format: "currency" },
        { key: "total", label: "Total", format: "currency" },
        { key: "deposit_amount", label: "Deposit", format: "currency" },
        { key: "status", label: "Status", format: "status" },
        { key: "approved_at", label: "Approved", format: "datetime" },
      ]}
      emptyTitle="Proposal not found"
      emptyDescription="This proposal may have been removed or archived."
    />
  );
}

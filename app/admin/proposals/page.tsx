import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function ProposalsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Sales"
      title="Proposals"
      description="Draft, sent, viewed, and approved proposals tied to project workspaces."
      table="proposals"
      detailBaseHref="/admin/proposals"
      actionHref="/admin/proposals/new"
      actionLabel="New Proposal"
      columns={[
        { key: "proposal_number", label: "Proposal" },
        { key: "title", label: "Title" },
        { key: "total", label: "Total", format: "currency" },
        { key: "deposit_amount", label: "Deposit", format: "currency" },
        { key: "status", label: "Status", format: "status" },
        { key: "expiration_date", label: "Expires", format: "date" },
      ]}
      emptyTitle="No proposals yet"
      emptyDescription="Create a proposal from a qualified project before contract and invoice steps."
    />
  );
}

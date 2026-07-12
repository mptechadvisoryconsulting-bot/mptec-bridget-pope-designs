import { AdminResourcePage } from "@/components/admin/AdminResourcePage";
import { ProposalBuilder } from "@/components/admin/ProposalBuilder";

export default function ProposalsPage() {
  return (
    <>
      <AdminResourcePage eyebrow="Sales" title="Proposals" table="proposals" detailBaseHref="/admin/proposals" columns={["proposal_number", "title", "total", "status", "expires_at", "created_at"]} actionHref="/admin/proposals/new" actionLabel="New Proposal" />
      <div style={{ marginTop: 16 }}>
        <ProposalBuilder />
      </div>
    </>
  );
}

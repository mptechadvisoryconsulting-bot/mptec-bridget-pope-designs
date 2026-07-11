import { AdminSectionPage } from "@/components/admin/AdminSectionPage";
import { ProposalBuilder } from "@/components/admin/ProposalBuilder";

export default function ProposalsPage() {
  return (
    <>
      <AdminSectionPage eyebrow="Sales" title="Proposals" icon="proposal" />
      <div style={{ marginTop: 16 }}>
        <ProposalBuilder />
      </div>
    </>
  );
}

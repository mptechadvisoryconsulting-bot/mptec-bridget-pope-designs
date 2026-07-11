import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function ProposalBuilder() {
  return (
    <section className="panel">
      <h2>Proposal Builder</h2>
      <div style={{ display: "grid", gap: 14 }}>
        <p className="mini-meta">Create a proposal from a real client project. No sample line items are shown here.</p>
        <ButtonLink href="/admin/proposals/new">
          <Plus size={16} /> New Proposal
        </ButtonLink>
      </div>
    </section>
  );
}

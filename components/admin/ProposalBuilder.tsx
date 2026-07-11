import { FileSignature, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { proposalItems } from "@/lib/data";
import { currency } from "@/lib/currency";

export function ProposalBuilder() {
  const total = proposalItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <section className="panel">
      <h2>Proposal Builder</h2>
      <div style={{ display: "grid", gap: 14 }}>
        {proposalItems.map((item) => (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }} key={item.name}>
            <span>{item.name}</span>
            <strong>{currency(item.price)}</strong>
          </div>
        ))}
        <div style={{ borderTop: "1px solid #eee2e5", display: "flex", justifyContent: "space-between", paddingTop: 14 }}>
          <strong>Total</strong>
          <strong>{currency(total)}</strong>
        </div>
        <ButtonLink href="/admin/proposals/new">
          <Plus size={16} /> New Proposal
        </ButtonLink>
        <ButtonLink href="/client/proposals/proposal-1001" variant="light">
          <FileSignature size={16} /> Preview Client View
        </ButtonLink>
      </div>
    </section>
  );
}

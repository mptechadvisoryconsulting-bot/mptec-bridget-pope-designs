import { FileSignature } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { proposalItems } from "@/lib/data";
import { currency } from "@/lib/currency";

export default async function ClientProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const total = proposalItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Proposal {proposalId}</span>
          <h1>Luxury Wedding Design Proposal</h1>
          <p className="mini-meta">Review the service list, rental list, labor, delivery, deposit, total, and expiration date.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Proposal Items</h2>
        <table className="table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
          </thead>
          <tbody>
            {proposalItems.map((item) => (
              <tr key={item.name}><td>{item.name}</td><td>{item.qty}</td><td>{currency(item.price)}</td></tr>
            ))}
            <tr><td><strong>Total</strong></td><td /><td><strong>{currency(total)}</strong></td></tr>
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <ButtonLink href="/client/contracts/contract-1001"><FileSignature size={16} /> Approve Proposal</ButtonLink>
          <ButtonLink href="/client/messages" variant="light">Ask a Question</ButtonLink>
        </div>
      </section>
    </div>
  );
}

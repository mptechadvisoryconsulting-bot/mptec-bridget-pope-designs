import { FileSignature } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { project } = await requireClientPortalContext(`/client/proposals/${proposalId}`);
  const { data: proposal } = await createAdminClient()
    .from("proposals")
    .select("*, bpd_proposal_items(*)")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal || proposal.project_id !== project?.id) {
    notFound();
  }

  const items = proposal.bpd_proposal_items ?? [];

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">{proposal.proposal_number ?? "Proposal"}</span>
          <h1>{proposal.title ?? "Event Design Proposal"}</h1>
          <p className="mini-meta">{proposal.introduction ?? "Review the proposal shared by Bridget Pope Designs."}</p>
        </div>
      </div>
      <section className="panel">
        <h2>Proposal Items</h2>
        <table className="table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}><td>{item.title}</td><td>{item.quantity}</td><td>{currency(Number(item.unit_price ?? 0))}</td><td>{currency(Number(item.total ?? 0))}</td></tr>
            ))}
            {!items.length ? <tr><td colSpan={4}>No proposal items have been added yet.</td></tr> : null}
            <tr><td><strong>Total</strong></td><td /><td /><td><strong>{currency(Number(proposal.total ?? 0))}</strong></td></tr>
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <ButtonLink href="/client/contracts"><FileSignature size={16} /> View Contracts</ButtonLink>
          <ButtonLink href="/client/messages" variant="light">Ask a Question</ButtonLink>
        </div>
      </section>
    </div>
  );
}

import { FileSignature } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientProposalsPage() {
  const { project } = await requireClientPortalContext("/client/proposals");
  const { data: proposals } = project?.id
    ? await createAdminClient()
        .from("proposals")
        .select("id,proposal_number,title,total,deposit_amount,expiration_date,status")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Proposals</span><h1>Proposal and Design Scope</h1></div></div>
      <section className="panel">
        <h2>Shared Proposals</h2>
        <table className="table">
          <thead><tr><th>Proposal</th><th>Status</th><th>Total</th><th>Deposit</th><th>Expires</th><th /></tr></thead>
          <tbody>
            {(proposals ?? []).map((proposal) => (
              <tr key={proposal.id}>
                <td>{proposal.title || proposal.proposal_number}</td>
                <td><span className="status">{proposal.status}</span></td>
                <td>{currency(Number(proposal.total ?? 0))}</td>
                <td>{currency(Number(proposal.deposit_amount ?? 0))}</td>
                <td>{proposal.expiration_date ?? "Not set"}</td>
                <td><ButtonLink href={`/client/proposals/${proposal.id}`} variant="light"><FileSignature size={16} /> Review</ButtonLink></td>
              </tr>
            ))}
            {!proposals?.length ? <tr><td colSpan={6}>No proposals have been shared yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

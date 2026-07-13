import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { sendProposal } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export default async function ProposalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ proposalId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { proposalId } = await params;
  const { action } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "send") {
    await sendProposal(supabase, proposalId, profile?.id);
    redirect(`/admin/proposals/${proposalId}`);
  }

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, bpd_proposal_items(*), bpd_projects(event_name,event_date,venue_name,bpd_clients(bpd_profiles(first_name,last_name,email)))")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) notFound();

  const items = proposal.bpd_proposal_items ?? [];
  const project = first(proposal.bpd_projects);
  const client = first(project?.bpd_clients);
  const clientProfile = first(client?.bpd_profiles);
  const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || clientProfile?.email || "Client";
  const sentAt = proposal.status !== "draft" ? proposal.updated_at : null;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Sales · {proposal.proposal_number}</span>
          <h1>{proposal.title ?? "Event Design Proposal"}</h1>
          <p className="mini-meta">{project?.event_name ?? "Project"} for {clientName}</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href={`/admin/proposals/${proposalId}?action=send`} variant="secondary">
            {proposal.status === "draft" ? "Send Proposal" : "Resend Proposal"}
          </ButtonLink>
          <ButtonLink href="/admin/invoices" variant="light">Create Invoice</ButtonLink>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel span-2">
          <h2>Proposal Items</h2>
          {proposal.introduction ? <p className="mini-meta">{proposal.introduction}</p> : null}
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Category</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              {items.map((item: Record<string, unknown>) => (
                <tr key={String(item.id)}>
                  <td>{String(item.title ?? "")}<div className="mini-meta">{String(item.description ?? "")}</div></td>
                  <td>{String(item.category ?? "—")}</td>
                  <td>{String(item.quantity ?? 1)}</td>
                  <td>{currency(Number(item.unit_price ?? 0))}</td>
                  <td>{currency(Number(item.total ?? 0))}</td>
                </tr>
              ))}
              {!items.length ? <tr><td colSpan={5}>No proposal line items have been added yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Financial Summary</h2>
          <ul className="list">
            <li><span>Subtotal</span><strong>{currency(Number(proposal.subtotal ?? 0))}</strong></li>
            <li><span>Discount</span><strong>-{currency(Number(proposal.discount_amount ?? 0))}</strong></li>
            <li><span>Tax</span><strong>{currency(Number(proposal.tax_amount ?? 0))}</strong></li>
            <li><span>Total</span><strong>{currency(Number(proposal.total ?? 0))}</strong></li>
            <li><span>Deposit Required</span><strong>{currency(Number(proposal.deposit_amount ?? 0))}</strong></li>
          </ul>
        </section>

        <section className="panel span-2">
          <h2>Status</h2>
          <ul className="list">
            <li><span>Status</span><span className="status">{statusLabels[proposal.status] ?? proposal.status}</span></li>
            <li><span>Sent</span><span>{formatDateTime(sentAt, "Not sent")}</span></li>
            <li><span>Expires</span><span>{formatDate(proposal.expiration_date, "No expiration set")}</span></li>
            <li><span>Approved</span><span>{formatDateTime(proposal.approved_at, "Not approved")}</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

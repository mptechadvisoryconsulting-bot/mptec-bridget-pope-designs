import { notFound, redirect } from "next/navigation";
import { ProposalDocumentActions } from "@/components/proposals/ProposalDocumentActions";
import { UploadProposalPdfForm } from "@/components/proposals/UploadProposalPdfForm";
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
  changes_requested: "Changes Requested",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
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

  // Disambiguate proposal→project FK (PostgREST otherwise returns HTTP 300 and the page 404s).
  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, bpd_proposal_items(*)")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) notFound();

  if (action === "send") {
    // A revised proposal should return to the normal sent/awaiting-response state.
    if (["changes_requested", "rejected", "viewed"].includes(proposal.status)) {
      await supabase
        .from("proposals")
        .update({ status: "draft", approved_at: null, updated_at: new Date().toISOString() })
        .eq("id", proposalId);
    }
    await sendProposal(supabase, proposalId, profile?.id);
    redirect(`/admin/proposals/${proposalId}`);
  }

  const { data: projectRow } = await supabase
    .from("projects")
    .select("event_name,event_date,venue_name,client_id")
    .eq("id", proposal.project_id)
    .maybeSingle();

  let clientName = "Client";
  if (projectRow?.client_id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("bpd_profiles(first_name,last_name,email)")
      .eq("id", projectRow.client_id)
      .maybeSingle();
    const clientProfile = first(clientRow?.bpd_profiles);
    clientName =
      [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || clientProfile?.email || "Client";
  }

  const { data: latestClientResponse } = await supabase
    .from("activity_logs")
    .select("action,metadata,created_at")
    .eq("entity_type", "proposal")
    .eq("entity_id", proposalId)
    .in("action", ["proposal_changes_requested", "proposal_rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const responseMetadata = (latestClientResponse?.metadata ?? {}) as Record<string, unknown>;
  const responseNote = typeof responseMetadata.note === "string" ? responseMetadata.note : "";

  const items = proposal.bpd_proposal_items ?? [];
  const project = projectRow;
  const sentAt =
    proposal.sent_at ??
    (proposal.status !== "draft" && proposal.status !== "cancelled" ? proposal.updated_at : null);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Sales · {proposal.proposal_number}</span>
          <h1>{proposal.title ?? "Event Design Proposal"}</h1>
          <p className="mini-meta">{project?.event_name ?? "Project"} for {clientName}</p>
        </div>
        <div className="topbar-actions">
          {!(["cancelled", "approved"].includes(proposal.status)) ? (
            <ButtonLink href={`/admin/proposals/${proposalId}?action=send`} variant="secondary">
              {proposal.status === "draft" ? "Send Proposal" : "Resend Proposal"}
            </ButtonLink>
          ) : null}
          {proposal.status === "changes_requested" || proposal.status === "rejected" ? (
            <ButtonLink href={`/admin/proposals/new?projectId=${proposal.project_id}`} variant="light">Create Revision</ButtonLink>
          ) : null}
          <ButtonLink href="/admin/invoices" variant="light">Create Invoice</ButtonLink>
          <ProposalDocumentActions
            extraActions={[{ label: "Upload PDF", href: "#upload-proposal-pdf" }]}
            proposalId={proposal.id}
            status={proposal.status}
          />
        </div>
      </div>

      <div className="dashboard-grid">
        <UploadProposalPdfForm proposalId={proposal.id} />

        {proposal.status === "changes_requested" || proposal.status === "rejected" ? (
          <section className="panel span-2">
            <h2>{proposal.status === "changes_requested" ? "Client requested changes" : "Client declined proposal"}</h2>
            <p className="mini-meta">
              {proposal.status === "changes_requested"
                ? "Review the request, discuss details in Messages if needed, then revise and resend the proposal. No invoice is created until the client approves."
                : "No invoice was created. You can contact the client or create a revised proposal if they want to reconsider."}
            </p>
            {responseNote ? <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{responseNote}</p> : null}
            {latestClientResponse?.created_at ? <p className="mini-meta">Received {formatDateTime(latestClientResponse.created_at)}</p> : null}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <ButtonLink href="/admin/messages" variant="secondary">Open Messages</ButtonLink>
              <ButtonLink href={`/admin/proposals/new?projectId=${proposal.project_id}`} variant="light">Create Revision</ButtonLink>
            </div>
          </section>
        ) : null}

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
          {proposal.uploaded_pdf_path ? (
            <p className="mini-meta" style={{ marginTop: 12 }}>
              Uploaded PDF: {proposal.uploaded_pdf_original_name ?? "proposal.pdf"}
              {proposal.uploaded_pdf_uploaded_at ? ` · ${formatDateTime(proposal.uploaded_pdf_uploaded_at)}` : ""}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

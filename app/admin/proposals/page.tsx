import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { sendProposal } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type ProjectRef = { event_name?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type ProposalRow = {
  id: string;
  proposal_number: string;
  title?: string | null;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string }> }) {
  const { action, id } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "send" && id) {
    await sendProposal(supabase, id, profile?.id);
    redirect("/admin/proposals");
  }

  const { data } = await supabase
    .from("proposals")
    .select("id,proposal_number,title,total,status,created_at,updated_at,project_id,bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name)))")
    .order("created_at", { ascending: false })
    .limit(100);

  const proposals = (data ?? []) as ProposalRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Sales</span>
          <h1>Proposals</h1>
          <p className="mini-meta">Draft, sent, viewed, and approved proposals tied to project workspaces.</p>
        </div>
        <ButtonLink href="/admin/proposals/new">New Proposal</ButtonLink>
      </div>

      <section className="panel">
        <h2>{proposals.length} Proposal{proposals.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Proposal</th>
              <th>Client</th>
              <th>Project</th>
              <th>Amount</th>
              <th>Sent</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => {
              const project = first(proposal.bpd_projects);
              const client = first(project?.bpd_clients);
              const clientProfile = first(client?.bpd_profiles);
              const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "Client";
              const sentAt = proposal.status !== "draft" ? proposal.updated_at : null;

              return (
                <tr key={proposal.id}>
                  <td><a href={`/admin/proposals/${proposal.id}`}>{proposal.proposal_number}</a><div className="mini-meta">{proposal.title || "Event Design Proposal"}</div></td>
                  <td>{clientName}</td>
                  <td>{project?.event_name ?? "Project"}</td>
                  <td>{currency(Number(proposal.total ?? 0))}</td>
                  <td>{formatDateTime(sentAt, "Not sent")}</td>
                  <td><span className="status">{statusLabels[proposal.status] ?? proposal.status}</span></td>
                  <td>
                    <div className="topbar-actions">
                      <ButtonLink href={`/admin/proposals/${proposal.id}`} variant="light">Preview</ButtonLink>
                      <ButtonLink href={`/admin/proposals?action=send&id=${proposal.id}`} variant="light">
                        {proposal.status === "draft" ? "Send" : "Resend"}
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!proposals.length ? (
              <tr>
                <td colSpan={7}>
                  <strong>No proposals yet</strong>
                  <div className="mini-meta">Create a proposal from a qualified project before contract and invoice steps.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

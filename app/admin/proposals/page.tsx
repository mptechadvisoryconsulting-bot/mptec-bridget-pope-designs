import { redirect } from "next/navigation";
import { ImportProposalPdfForm } from "@/components/proposals/ImportProposalPdfForm";
import { ProposalDocumentActions } from "@/components/proposals/ProposalDocumentActions";
import { ListPageActions } from "@/components/admin/ListPageActions";
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
  cancelled: "Cancelled",
};

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string }> }) {
  const { action, id } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "send" && id) {
    await sendProposal(supabase, id, profile?.id);
    redirect("/admin/proposals");
  }

  const [{ data }, { data: allProjects }] = await Promise.all([
    supabase
      .from("proposals")
      .select("id,proposal_number,title,total,status,created_at,updated_at,project_id")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("projects").select("id,event_name,client_id").order("created_at", { ascending: false }),
  ]);

  const proposalRows = data ?? [];
  const projectIds = [...new Set(proposalRows.map((row) => row.project_id).filter(Boolean))];
  const projectsForRows = (allProjects ?? []).filter((project) => projectIds.includes(project.id));
  const projectById = new Map((allProjects ?? []).map((project) => [project.id, project]));
  const clientIds = [...new Set(projectsForRows.map((project) => project.client_id).filter(Boolean))] as string[];
  const { data: clients } = clientIds.length
    ? await supabase.from("clients").select("id,bpd_profiles(first_name,last_name)").in("id", clientIds)
    : { data: [] as { id: string; bpd_profiles: unknown }[] };
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));

  const proposals = proposalRows.map((row) => {
    const project = projectById.get(row.project_id);
    const client = project?.client_id ? clientById.get(project.client_id) : null;
    return {
      ...row,
      bpd_projects: project
        ? {
            event_name: project.event_name,
            bpd_clients: client ? { bpd_profiles: client.bpd_profiles } : null,
          }
        : null,
    };
  }) as ProposalRow[];

  const importProjects = ((allProjects ?? []) as { id: string; event_name: string | null }[]).map((project) => ({
    id: project.id,
    name: project.event_name || "Project",
  }));

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Sales</span>
          <h1>Proposals</h1>
          <p className="mini-meta">Draft, sent, viewed, and approved proposals tied to project workspaces.</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/proposals/new">New Proposal</ButtonLink>
          <ListPageActions importHref="#import-proposal-pdf" importLabel="Import PDF" />
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <ImportProposalPdfForm projects={importProjects} />
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
              const sentAt = proposal.status !== "draft" && proposal.status !== "cancelled" ? proposal.updated_at : null;

              return (
                <tr key={proposal.id}>
                  <td><a href={`/admin/proposals/${proposal.id}`}>{proposal.proposal_number}</a><div className="mini-meta">{proposal.title || "Event Design Proposal"}</div></td>
                  <td>{clientName}</td>
                  <td>{project?.event_name ?? "Project"}</td>
                  <td>{currency(Number(proposal.total ?? 0))}</td>
                  <td>{formatDateTime(sentAt, "Not sent")}</td>
                  <td><span className="status">{statusLabels[proposal.status] ?? proposal.status}</span></td>
                  <td>
                    <ProposalDocumentActions
                      extraActions={[
                        { label: "Preview", href: `/admin/proposals/${proposal.id}` },
                        {
                          label: proposal.status === "draft" ? "Send" : "Resend",
                          href: `/admin/proposals?action=send&id=${proposal.id}`,
                        },
                      ]}
                      primaryHref={
                        proposal.status === "draft"
                          ? `/admin/proposals?action=send&id=${proposal.id}`
                          : `/admin/proposals/${proposal.id}`
                      }
                      primaryLabel={proposal.status === "draft" ? "Send" : "Preview"}
                      proposalId={proposal.id}
                      redirectOnDelete={null}
                      status={proposal.status}
                    />
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

import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { sendContract } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type ProjectRef = { event_name?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type ContractRow = {
  id: string;
  contract_number: string;
  status: string;
  client_signature?: string | null;
  client_signed_at?: string | null;
  owner_signed_at?: string | null;
  created_at: string;
  updated_at: string;
  project_id: string;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
};

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string }> }) {
  const { action, id } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "send" && id) {
    await sendContract(supabase, id, profile?.id);
    redirect("/admin/contracts");
  }

  const { data } = await supabase
    .from("contracts")
    .select("id,contract_number,status,client_signature,client_signed_at,owner_signed_at,created_at,updated_at,project_id,bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name)))")
    .order("created_at", { ascending: false })
    .limit(100);

  const contracts = (data ?? []) as ContractRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Documents</span>
          <h1>Contracts</h1>
          <p className="mini-meta">Contract drafts, sent agreements, and signature status for booked projects.</p>
        </div>
      </div>

      <section className="panel">
        <h2>{contracts.length} Contract{contracts.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Client</th>
              <th>Project</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Signature</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const project = first(contract.bpd_projects);
              const client = first(project?.bpd_clients);
              const clientProfile = first(client?.bpd_profiles);
              const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "Client";
              const sentAt = contract.status !== "draft" ? contract.updated_at : null;

              return (
                <tr key={contract.id}>
                  <td><ButtonLink href={`/admin/projects/${contract.project_id}`} variant="light">{contract.contract_number}</ButtonLink></td>
                  <td>{clientName}</td>
                  <td>{project?.event_name ?? "Project"}</td>
                  <td><StatusBadge status={contract.status} /></td>
                  <td>{formatDateTime(sentAt, "Not sent")}</td>
                  <td>{contract.client_signed_at ? `Signed ${formatDateTime(contract.client_signed_at)}` : contract.owner_signed_at ? "Awaiting client" : "Unsigned"}</td>
                  <td>
                    <ButtonLink href={`/admin/contracts?action=send&id=${contract.id}`} variant="light">
                      {contract.status === "draft" ? "Send" : "Resend"}
                    </ButtonLink>
                  </td>
                </tr>
              );
            })}
            {!contracts.length ? (
              <tr>
                <td colSpan={7}>
                  <strong>No contracts yet</strong>
                  <div className="mini-meta">Approved proposals can generate contracts for client signature.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

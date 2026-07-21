import { FileSignature } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const { project } = await requireClientPortalContext("/client/contracts");
  const { data: contracts } = project?.id
    ? await createAdminClient()
        .from("contracts")
        .select("id,contract_number,status,client_signed_at,created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Contracts</span><h1>Contracts and Signatures</h1></div></div>
      <section className="panel">
        <h2>Shared Contracts</h2>
        <table className="table">
          <thead><tr><th>Contract</th><th>Status</th><th>Signed</th><th /></tr></thead>
          <tbody>
            {(contracts ?? []).map((contract) => (
              <tr key={contract.id}>
                <td>{contract.contract_number ?? contract.id.slice(0, 8)}</td>
                <td><StatusBadge status={contract.status} /></td>
                <td>{contract.client_signed_at ?? "Not signed"}</td>
                <td><ButtonLink href={`/client/contracts/${contract.id}`} variant="light"><FileSignature size={16} /> Open</ButtonLink></td>
              </tr>
            ))}
            {!contracts?.length ? <tr><td colSpan={4}>No contracts have been shared yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

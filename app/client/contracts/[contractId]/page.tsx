import { FileSignature } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const { project } = await requireClientPortalContext(`/client/contracts/${contractId}`);
  const { data: contract } = await createAdminClient()
    .from("contracts")
    .select("id,contract_number,content,status,client_signature,client_signed_at,signed_document_url,project_id")
    .eq("id", contractId)
    .maybeSingle();

  if (!contract || contract.project_id !== project?.id) {
    notFound();
  }

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">{contract.contract_number ?? "Contract"}</span>
          <h1>Event Services Agreement</h1>
          <p className="mini-meta">Contract status and signed copies sync from the admin dashboard.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Signature Status</h2>
        <ul className="list">
          <li><span>Status</span><span className="status">{contract.status}</span></li>
          <li><span>Signed At</span><strong>{contract.client_signed_at ?? "Not signed"}</strong></li>
          <li><span>Signature</span><strong>{contract.client_signature ?? "Not signed"}</strong></li>
        </ul>
        {contract.content ? <p>{contract.content}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          {contract.signed_document_url ? <ButtonLink href={contract.signed_document_url}><FileSignature size={16} /> Download Signed Copy</ButtonLink> : null}
          <ButtonLink href="/client/invoices" variant="light">Continue to Invoices</ButtonLink>
        </div>
      </section>
    </div>
  );
}

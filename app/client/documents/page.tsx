import { FileText } from "lucide-react";
import { requireClientPortalContext } from "@/lib/client-portal";
import { currency } from "@/lib/currency";
import { applyClientInvoiceVisibilityFilter } from "@/lib/invoices/client-visibility";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsPage() {
  const { client, project } = await requireClientPortalContext("/client/documents");
  const supabase = createAdminClient();
  const [{ data: files }, { data: invoices }, { data: contracts }] = await Promise.all([
    project?.id
      ? supabase
          .from("files")
          .select("id,file_name,storage_path,category,created_at")
          .eq("project_id", project.id)
          .in("visibility", ["client_visible", "client_upload"])
          .order("created_at", { ascending: false })
      : { data: [] },
    client?.id
      ? applyClientInvoiceVisibilityFilter(
          supabase
            .from("invoices")
            .select("id,invoice_number,total,balance_due,status,created_at")
            .eq("client_id", client.id)
            .order("created_at", { ascending: false }),
        )
      : { data: [] },
    project?.id
      ? supabase
          .from("contracts")
          .select("id,contract_number,status,signed_document_url,created_at")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
      : { data: [] },
  ]);

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Documents</span>
          <h1>Design Files, Receipts, and PDFs</h1>
          <p className="mini-meta">Documents shown here are attached to your active project.</p>
        </div>
      </div>
      <div className="client-grid">
        <section className="panel">
          <h2>Shared Files</h2>
          <ul className="list">
            {(files ?? []).map((file) => (
              <li key={file.id}>
                <span><FileText size={16} /> {file.file_name}</span>
                {file.storage_path?.startsWith("http") || file.storage_path?.startsWith("/") ? <a href={file.storage_path}>Open</a> : <span className="mini-meta">{file.category ?? "File"}</span>}
              </li>
            ))}
            {!files?.length ? <li>No files have been shared yet.</li> : null}
          </ul>
        </section>
        <section className="panel">
          <h2>Invoice PDFs</h2>
          <ul className="list">
            {(invoices ?? []).map((invoice) => (
              <li key={invoice.id}>
                <a href={`/client/invoices/${invoice.id}`}>{invoice.invoice_number}</a>
                <span className="status">{invoice.status} - {currency(Number(invoice.balance_due ?? invoice.total ?? 0))}</span>
              </li>
            ))}
            {!invoices?.length ? <li>No invoices have been shared yet.</li> : null}
          </ul>
        </section>
        <section className="panel">
          <h2>Contracts</h2>
          <ul className="list">
            {(contracts ?? []).map((contract) => (
              <li key={contract.id}>
                <a href={`/client/contracts/${contract.id}`}>{contract.contract_number}</a>
                <span className="status">{contract.status}</span>
              </li>
            ))}
            {!contracts?.length ? <li>No contracts have been shared yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";
import { DownloadInvoicePdfButton } from "@/components/invoices/DownloadInvoicePdfButton";
import { PayInvoiceButton } from "@/components/invoices/PayInvoiceButton";
import { PrintInvoiceButton } from "@/components/invoices/PrintInvoiceButton";
import { displayName } from "@/lib/auth/current-profile";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { profile, client } = await requireClientPortalContext(`/client/invoices/${invoiceId}`);
  const { data: invoice } = await createAdminClient()
    .from("invoices")
    .select("*, bpd_invoice_items(*), bpd_invoice_versions(*), bpd_projects(event_name,event_date,venue_name,bpd_clients(profile_id))")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice || invoice.client_id !== client?.id) {
    notFound();
  }

  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const owningClient = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;

  if (owningClient?.profile_id !== profile.id) {
    notFound();
  }

  const items = invoice.bpd_invoice_items ?? [];
  const isPayable = !["paid", "cancelled", "refunded"].includes(invoice.status) && Number(invoice.balance_due ?? 0) > 0;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Invoice</span>
          <h1>{invoice.invoice_number}</h1>
        </div>
        <div className="topbar-actions invoice-actions-print">
          {isPayable ? <PayInvoiceButton invoiceId={invoice.id} /> : null}
          <DownloadInvoicePdfButton invoiceId={invoice.id} />
          <PrintInvoiceButton />
        </div>
      </div>

      <section className="panel invoice-shell">
        <InvoiceDocument
          clientEmail={profile.email}
          clientName={displayName(profile)}
          invoice={invoice}
          items={items}
          projectName={project?.event_name}
          venue={project?.venue_name}
        />
      </section>
    </div>
  );
}

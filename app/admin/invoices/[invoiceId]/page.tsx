import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";
import { PrintInvoiceButton } from "@/components/invoices/PrintInvoiceButton";
import { SendInvoiceButton } from "@/components/invoices/SendInvoiceButton";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { data: invoice } = await createAdminClient()
    .from("invoices")
    .select("*, bpd_invoice_items(*), bpd_invoice_versions(*), bpd_clients(bpd_profiles(first_name,last_name,email,username)), bpd_projects(event_name,event_date,venue_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  const items = invoice.bpd_invoice_items ?? [];
  const client = Array.isArray(invoice.bpd_clients) ? invoice.bpd_clients[0] : invoice.bpd_clients;
  const profile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;
  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Invoice Preview</span>
          <h1>{invoice.invoice_number}</h1>
        </div>
        <div className="topbar-actions">
          <SendInvoiceButton invoiceId={invoice.id} />
          <PrintInvoiceButton />
        </div>
      </div>
      <section className="panel invoice-shell">
        <InvoiceDocument
          clientEmail={profile?.email}
          clientName={clientName}
          invoice={invoice}
          items={items}
          projectName={project?.event_name}
          venue={project?.venue_name}
        />
      </section>
    </div>
  );
}

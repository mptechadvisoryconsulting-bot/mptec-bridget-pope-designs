import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";
import { DownloadInvoicePdfButton } from "@/components/invoices/DownloadInvoicePdfButton";
import { InvoicePaymentHistory } from "@/components/invoices/InvoicePaymentHistory";
import { PrintInvoiceButton } from "@/components/invoices/PrintInvoiceButton";
import { RecordManualPaymentForm } from "@/components/invoices/RecordManualPaymentForm";
import { SendInvoiceButton } from "@/components/invoices/SendInvoiceButton";
import { ButtonLink } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, bpd_invoice_items(*), bpd_invoice_versions(*), bpd_clients(bpd_profiles(first_name,last_name,email,username)), bpd_projects(event_name,event_date,venue_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: payments } = await supabase
    .from("payments")
    .select("id,amount,gross_amount,payment_method,payment_model,status,paid_at,metadata,created_at")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false });

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
          {!["paid", "cancelled", "refunded", "partially_refunded"].includes(invoice.status) ? (
            <ButtonLink href={`/admin/invoices/${invoice.id}/edit`} variant="light">
              <Pencil size={16} /> Edit Invoice
            </ButtonLink>
          ) : null}
          <SendInvoiceButton invoiceId={invoice.id} />
          <DownloadInvoicePdfButton invoiceId={invoice.id} />
          <PrintInvoiceButton />
        </div>
      </div>
      {Number(invoice.active_version ?? 1) > 1 ? (
        <p className="mini-meta invoice-version-banner">
          This invoice is on version {invoice.active_version}. A new version is created automatically whenever a sent invoice
          is revised, preserving the original as an immutable record.
        </p>
      ) : null}

      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <RecordManualPaymentForm
          balanceDue={Number(invoice.balance_due ?? 0)}
          invoiceId={invoice.id}
          invoiceStatus={invoice.status}
        />
        <InvoicePaymentHistory payments={payments ?? []} />
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

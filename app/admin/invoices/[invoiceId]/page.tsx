import { notFound } from "next/navigation";
import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { data: invoice } = await createAdminClient()
    .from("invoices")
    .select("*, bpd_invoice_items(*), bpd_clients(bpd_profiles(first_name,last_name,email,username)), bpd_projects(event_name,event_date,venue_name)")
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
      </div>
      <section className="panel">
        <div className="invoice-preview-grid">
          <div>
            <h2>{clientName}</h2>
            <p className="mini-meta">{project?.event_name ?? "Project"} - {invoice.invoice_type}</p>
            <p>{invoice.description}</p>
          </div>
          <div>
            <p><strong>Status:</strong> {invoice.status}</p>
            <p><strong>Due:</strong> {invoice.due_date ?? "Not set"}</p>
            <p><strong>Balance:</strong> {currency(Number(invoice.balance_due ?? 0))}</p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.description ?? ""}</td>
                <td>{item.quantity}</td>
                <td>{currency(Number(item.unit_price ?? 0))}</td>
                <td>{currency(Number(item.total ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-total">
          <span>Subtotal {currency(Number(invoice.subtotal ?? 0))}</span>
          <span>Tax {currency(Number(invoice.tax_amount ?? 0))}</span>
          <span>Discount {currency(Number(invoice.discount_amount ?? 0))}</span>
          <strong>Total {currency(Number(invoice.total ?? 0))}</strong>
        </div>
      </section>
    </div>
  );
}

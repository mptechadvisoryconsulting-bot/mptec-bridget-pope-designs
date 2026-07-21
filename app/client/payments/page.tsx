import { PaymentCard } from "@/components/client/PaymentCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currency } from "@/lib/currency";
import { applyClientInvoiceVisibilityFilter } from "@/lib/invoices/client-visibility";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { client } = await requireClientPortalContext("/client/payments");
  const { data: invoices } = client?.id
    ? await applyClientInvoiceVisibilityFilter(
        createAdminClient()
          .from("invoices")
          .select("id,invoice_number,balance_due,total,amount_paid,due_date,status")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false }),
      )
    : { data: [] };
  const nextInvoice = (invoices ?? []).find((invoice) => invoice.status !== "paid" && Number(invoice.balance_due ?? 0) > 0);

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Billing</span>
          <h1>Invoices & Payment Status</h1>
        </div>
      </div>
      <PaymentCard
        balanceDue={Number(nextInvoice?.balance_due ?? 0)}
        dueDate={nextInvoice?.due_date}
        status={nextInvoice?.status}
        invoiceId={nextInvoice?.id}
      />
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Invoice schedule</h2>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
          <tbody>
            {(invoices ?? []).map((invoice) => (
              <tr key={invoice.id}>
                <td><a href={`/client/invoices/${invoice.id}`}>{invoice.invoice_number}</a></td>
                <td><StatusBadge status={invoice.status} /></td>
                <td>{currency(Number(invoice.total ?? 0))}</td>
                <td>{currency(Number(invoice.amount_paid ?? 0))}</td>
                <td>{currency(Number(invoice.balance_due ?? 0))}</td>
              </tr>
            ))}
            {!invoices?.length ? <tr><td colSpan={5}>No invoices or payments have been shared yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

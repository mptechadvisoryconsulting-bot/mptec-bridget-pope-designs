import { StatusBadge } from "@/components/ui/StatusBadge";
import { currency } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type InvoiceRef = { invoice_number?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type PaymentRow = {
  id: string;
  amount: number;
  gross_amount?: number | null;
  payment_method?: string | null;
  payment_model?: string | null;
  status: string;
  paid_at?: string | null;
  created_at: string;
  bpd_invoices?: InvoiceRef | InvoiceRef[] | null;
};

function clientNameFromInvoice(invoice: InvoiceRef | null) {
  const client = first(invoice?.bpd_clients);
  const profile = first(client?.bpd_profiles);
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";
}

export default async function AdminPaymentsPage() {
  const supabase = createAdminClient();

  const [{ data: payments }, { data: outstandingInvoices }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id,amount,gross_amount,payment_method,payment_model,status,paid_at,created_at,bpd_invoices(invoice_number,bpd_clients(bpd_profiles(first_name,last_name)))",
      )
      .eq("payment_model", "manual")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("invoices").select("balance_due").gt("balance_due", 0),
  ]);

  const paymentRows = (payments ?? []) as PaymentRow[];

  const paidRows = paymentRows.filter((payment) => payment.status === "paid");
  const collected = paidRows.reduce((sum, payment) => sum + Number(payment.gross_amount ?? payment.amount ?? 0), 0);
  const outstanding = (outstandingInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Billing</span>
          <h1>Payment records</h1>
          <p className="mini-meta">Manual payments recorded against invoices.</p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Payment statistics">
        <article className="stat-card">
          <span>Collected</span>
          <strong>{currency(collected)}</strong>
          <small>{paidRows.length} paid transactions</small>
        </article>
        <article className="stat-card">
          <span>Outstanding</span>
          <strong>{currency(outstanding)}</strong>
          <small>Open invoice balances</small>
        </article>
        <article className="stat-card">
          <span>Records</span>
          <strong>{paymentRows.length}</strong>
          <small>Manual payment entries</small>
        </article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel span-2">
          <h2>Payment ledger</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Invoice</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((payment) => (
                <tr key={payment.id}>
                  <td>{clientNameFromInvoice(first(payment.bpd_invoices))}</td>
                  <td>{first(payment.bpd_invoices)?.invoice_number ?? "ΓÇö"}</td>
                  <td>{payment.payment_method || "manual"}</td>
                  <td>{currency(Number(payment.gross_amount ?? payment.amount ?? 0))}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td>{formatDateTime(payment.paid_at ?? payment.created_at)}</td>
                </tr>
              ))}
              {!paymentRows.length ? (
                <tr>
                  <td colSpan={6}>No manual payments recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

import { currency } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { stripeReadinessStatus } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type InvoiceRef = { invoice_number?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type PaymentRow = {
  id: string;
  amount: number;
  gross_amount?: number | null;
  platform_fee_amount?: number | null;
  stripe_processing_fee?: number | null;
  net_amount?: number | null;
  status: string;
  paid_at?: string | null;
  created_at: string;
  bpd_invoices?: InvoiceRef | InvoiceRef[] | null;
};

type PaymentAttemptRow = {
  id: string;
  amount: number;
  status: string;
  failure_message?: string | null;
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

  const [{ data: payments }, { data: attempts }, { data: outstandingInvoices }, settingsResult] = await Promise.all([
    supabase
      .from("payments")
      .select("id,amount,gross_amount,platform_fee_amount,stripe_processing_fee,net_amount,status,paid_at,created_at,bpd_invoices(invoice_number,bpd_clients(bpd_profiles(first_name,last_name)))")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("payment_attempts")
      .select("id,amount,status,failure_message,created_at,bpd_invoices(invoice_number,bpd_clients(bpd_profiles(first_name,last_name)))")
      .neq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("invoices").select("balance_due").gt("balance_due", 0),
    supabase
      .from("business_settings")
      .select("stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,payment_readiness_status,platform_fee_basis_points")
      .limit(1)
      .maybeSingle(),
  ]);

  const paymentRows = (payments ?? []) as PaymentRow[];
  const attemptRows = (attempts ?? []) as PaymentAttemptRow[];
  const { data: settings, error: settingsError } = settingsResult;

  const paidRows = paymentRows.filter((payment) => payment.status === "paid");
  const collected = paidRows.reduce((sum, payment) => sum + Number(payment.gross_amount ?? payment.amount ?? 0), 0);
  const platformFees = paidRows.reduce((sum, payment) => sum + Number(payment.platform_fee_amount ?? 0), 0);
  const netCollected = paidRows.reduce((sum, payment) => sum + Number(payment.net_amount ?? payment.amount ?? 0), 0);
  const outstanding = (outstandingInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const payoutStatus = settingsError ? "restricted" : stripeReadinessStatus(settings);

  const ledger = [
    ...paymentRows.map((payment) => ({
      id: payment.id,
      kind: "Payment" as const,
      client: clientNameFromInvoice(first(payment.bpd_invoices)),
      invoiceNumber: first(payment.bpd_invoices)?.invoice_number ?? "—",
      amount: Number(payment.gross_amount ?? payment.amount ?? 0),
      status: payment.status,
      at: payment.paid_at ?? payment.created_at,
    })),
    ...attemptRows.map((attempt) => ({
      id: attempt.id,
      kind: "Attempt" as const,
      client: clientNameFromInvoice(first(attempt.bpd_invoices)),
      invoiceNumber: first(attempt.bpd_invoices)?.invoice_number ?? "—",
      amount: Number(attempt.amount ?? 0),
      status: attempt.failure_message ? `${attempt.status}: ${attempt.failure_message}` : attempt.status,
      at: attempt.created_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Stripe</span>
          <h1>Payments</h1>
          <p className="mini-meta">Confirmed payments, failed attempts, platform fees, and payout readiness.</p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Payment statistics">
        <article className="stat-card"><span>Collected</span><strong>{currency(collected)}</strong><small>{paidRows.length} paid transactions</small></article>
        <article className="stat-card"><span>Outstanding</span><strong>{currency(outstanding)}</strong><small>Open invoice balances</small></article>
        <article className="stat-card"><span>Platform Fees</span><strong>{currency(platformFees)}</strong><small>Net to owner: {currency(netCollected)}</small></article>
        <article className="stat-card"><span>Payout Status</span><strong>{payoutStatus.replace(/_/g, " ")}</strong><small>{settings?.stripe_payouts_enabled ? "Payouts enabled" : "Payouts not enabled"}</small></article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel span-2">
          <h2>Payment Ledger</h2>
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Client</th><th>Invoice</th><th>Amount</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <td>{row.kind}</td>
                  <td>{row.client}</td>
                  <td>{row.invoiceNumber}</td>
                  <td>{currency(row.amount)}</td>
                  <td><span className="status">{row.status}</span></td>
                  <td>{formatDateTime(row.at)}</td>
                </tr>
              ))}
              {!ledger.length ? <tr><td colSpan={6}>No payment activity yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Payout Readiness</h2>
          <ul className="list">
            <li><span>Charges Enabled</span><span className="status">{settings?.stripe_charges_enabled ? "Yes" : "No"}</span></li>
            <li><span>Payouts Enabled</span><span className="status">{settings?.stripe_payouts_enabled ? "Yes" : "No"}</span></li>
            <li><span>Details Submitted</span><span className="status">{settings?.stripe_details_submitted ? "Yes" : "No"}</span></li>
            <li><span>Platform Fee</span><span className="status">{((Number(settings?.platform_fee_basis_points ?? 100)) / 100).toFixed(2)}%</span></li>
          </ul>
          {settings?.stripe_requirements_currently_due?.length ? (
            <p className="form-error">Stripe requires: {settings.stripe_requirements_currently_due.join(", ")}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

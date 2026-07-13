import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default async function ReportsPage() {
  const supabase = createAdminClient();

  const [{ data: invoices }, { data: payments }, { data: consultations }, { data: leads }] = await Promise.all([
    supabase.from("invoices").select("total,amount_paid,balance_due,status,created_at").limit(1000),
    supabase.from("payments").select("gross_amount,amount,status,paid_at,created_at").eq("status", "paid").limit(1000),
    supabase.from("consultations").select("status").limit(1000),
    supabase.from("leads").select("status").limit(1000),
  ]);

  const invoiceRows = invoices ?? [];
  const paymentRows = payments ?? [];
  const consultationRows = consultations ?? [];
  const leadRows = leads ?? [];

  const totalRevenue = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
  const totalOutstanding = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const totalInvoiced = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
  const paymentVolume = paymentRows.reduce((sum, payment) => sum + Number(payment.gross_amount ?? payment.amount ?? 0), 0);

  const completedConsultations = consultationRows.filter((row) => row.status === "completed").length;
  const scheduledConsultations = consultationRows.filter((row) => row.status === "scheduled").length;

  const convertedLeads = leadRows.filter((row) => row.status === "converted").length;
  const lostLeads = leadRows.filter((row) => row.status === "lost" || row.status === "archived").length;
  const conversionRate = leadRows.length ? Math.round((convertedLeads / leadRows.length) * 100) : 0;

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { date, label: monthLabel(date), amount: 0 };
  });

  for (const payment of paymentRows) {
    const at = payment.paid_at ?? payment.created_at;
    if (!at) continue;
    const paidDate = new Date(at);
    const bucket = months.find((month) => month.date.getFullYear() === paidDate.getFullYear() && month.date.getMonth() === paidDate.getMonth());
    if (bucket) bucket.amount += Number(payment.gross_amount ?? payment.amount ?? 0);
  }

  const maxMonthly = Math.max(...months.map((month) => month.amount), 1);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1>Revenue Reports</h1>
          <p className="mini-meta">Revenue, outstanding balances, consultation throughput, and lead conversion.</p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Report statistics">
        <article className="stat-card"><span>Revenue Collected</span><strong>{currency(totalRevenue)}</strong><small>Of {currency(totalInvoiced)} invoiced</small></article>
        <article className="stat-card"><span>Outstanding Balance</span><strong>{currency(totalOutstanding)}</strong></article>
        <article className="stat-card"><span>Payment Volume</span><strong>{currency(paymentVolume)}</strong><small>{paymentRows.length} paid transactions</small></article>
        <article className="stat-card"><span>Lead Conversion</span><strong>{conversionRate}%</strong><small>{convertedLeads} of {leadRows.length} leads</small></article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel span-2">
          <h2>Revenue by Month</h2>
          <div className="chart">
            {months.map((month) => (
              <div className="chart-row" key={month.label}>
                <span className="mini-meta">{month.label}</span>
                <div className="chart-track">
                  <div className="chart-fill" style={{ width: `${Math.round((month.amount / maxMonthly) * 100)}%` }} />
                </div>
                <strong>{currency(month.amount)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Consultations</h2>
          <ul className="list">
            <li><span>Total</span><strong>{consultationRows.length}</strong></li>
            <li><span>Scheduled</span><strong>{scheduledConsultations}</strong></li>
            <li><span>Completed</span><strong>{completedConsultations}</strong></li>
          </ul>
        </section>

        <section className="panel span-2">
          <h2>Lead Pipeline</h2>
          <ul className="list">
            <li><span>Total Leads</span><strong>{leadRows.length}</strong></li>
            <li><span>Converted</span><strong>{convertedLeads}</strong></li>
            <li><span>Lost / Archived</span><strong>{lostLeads}</strong></li>
            <li><span>Conversion Rate</span><strong>{conversionRate}%</strong></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

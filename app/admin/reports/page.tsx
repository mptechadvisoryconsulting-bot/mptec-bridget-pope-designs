import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createAdminClient();

  const [{ data: consultations }, { data: leads }, { data: projects }, { data: designActions }, { data: invoices }] = await Promise.all([
    supabase.from("consultations").select("status").limit(1000),
    supabase.from("leads").select("status,event_type").limit(1000),
    supabase.from("projects").select("status,event_type,event_date").limit(1000),
    supabase.from("design_updates").select("client_action_status,requires_client_action").eq("requires_client_action", true).limit(1000),
    supabase.from("invoices").select("status,balance_due").limit(1000),
  ]);

  const consultationRows = consultations ?? [];
  const leadRows = leads ?? [];
  const projectRows = projects ?? [];
  const designActionRows = designActions ?? [];
  const invoiceRows = invoices ?? [];

  const completedConsultations = consultationRows.filter((row) => row.status === "completed").length;
  const scheduledConsultations = consultationRows.filter((row) => row.status === "scheduled").length;
  const convertedLeads = leadRows.filter((row) => row.status === "converted").length;
  const conversionRate = leadRows.length ? Math.round((convertedLeads / leadRows.length) * 100) : 0;
  const pendingDesignActions = designActionRows.filter((row) => row.client_action_status === "pending" || row.client_action_status === "overdue").length;
  const openInvoices = invoiceRows.filter((row) => Number(row.balance_due ?? 0) > 0 && row.status !== "draft" && row.status !== "cancelled").length;
  const nextEvent = projectRows
    .filter((project) => project.event_date)
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))[0];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1>Project Reports</h1>
          <p className="mini-meta">Operational reporting for leads, consultations, projects, design actions, and invoices.</p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Report statistics">
        <article className="stat-card"><span>Total Leads</span><strong>{leadRows.length}</strong><small>{conversionRate}% converted</small></article>
        <article className="stat-card"><span>Consultations</span><strong>{consultationRows.length}</strong><small>{scheduledConsultations} scheduled, {completedConsultations} complete</small></article>
        <article className="stat-card"><span>Active Projects</span><strong>{projectRows.length}</strong><small>Client project workspaces</small></article>
        <article className="stat-card"><span>Needs Review</span><strong>{pendingDesignActions + openInvoices}</strong><small>Design + open invoices</small></article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>Lead Pipeline</h2>
          <ul className="list">
            <li><span>New</span><strong>{leadRows.filter((row) => row.status === "new").length}</strong></li>
            <li><span>Consultation Scheduled</span><strong>{leadRows.filter((row) => row.status === "consultation_scheduled").length}</strong></li>
            <li><span>Converted</span><strong>{convertedLeads}</strong></li>
            <li><span>Archived/Lost</span><strong>{leadRows.filter((row) => row.status === "archived" || row.status === "lost").length}</strong></li>
          </ul>
        </section>

        <section className="panel">
          <h2>Project Health</h2>
          <ul className="list">
            <li><span>Planning</span><strong>{projectRows.filter((row) => row.status === "planning").length}</strong></li>
            <li><span>Design In Progress</span><strong>{projectRows.filter((row) => row.status === "design_in_progress").length}</strong></li>
            <li><span>Finalizing</span><strong>{projectRows.filter((row) => row.status === "finalizing").length}</strong></li>
            <li><span>Next Event</span><strong>{formatDate(nextEvent?.event_date, "None")}</strong></li>
          </ul>
        </section>

        <section className="panel">
          <h2>Client Actions</h2>
          <ul className="list">
            <li><span>Pending/Overdue</span><strong>{pendingDesignActions}</strong></li>
            <li><span>Completed</span><strong>{designActionRows.filter((row) => row.client_action_status === "completed").length}</strong></li>
          </ul>
        </section>

        <section className="panel">
          <h2>Invoices</h2>
          <ul className="list">
            <li><span>Total tracked</span><strong>{invoiceRows.length}</strong></li>
            <li><span>Open balances</span><strong>{openInvoices}</strong></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

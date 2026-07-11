import { Bell, Plus } from "lucide-react";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { InventoryCalendar } from "@/components/admin/InventoryCalendar";
import { LeadPipeline } from "@/components/admin/LeadPipeline";
import { ProjectTable } from "@/components/admin/ProjectTable";
import { ProposalBuilder } from "@/components/admin/ProposalBuilder";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { tasks } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  new: "#c96f82",
  contacted: "#d9af6f",
  consultation_scheduled: "#222222",
  proposal_sent: "#b98b62",
  converted: "#7d8c74",
  lost: "#a8a0a2",
};

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const [{ data: leads }, { data: projects }, { data: invoices }, { count: unreadNotifications }, { count: projectCount }] = await Promise.all([
    supabase.from("leads").select("status,created_at").order("created_at", { ascending: false }),
    supabase.from("projects").select("event_name,event_type,event_date,status,budget").order("created_at", { ascending: false }).limit(6),
    supabase.from("invoices").select("total,balance_due,status,created_at"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }),
  ]);

  const leadRows = leads ?? [];
  const invoiceRows = invoices ?? [];
  const statusCounts = leadRows.reduce<Record<string, number>>((current, lead) => {
    current[lead.status] = (current[lead.status] ?? 0) + 1;
    return current;
  }, {});
  const pendingBalance = invoiceRows
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const paidRevenue = invoiceRows
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
  const stats = [
    { label: "Total Projects", value: String(projectCount ?? 0), note: "Synced client workspaces" },
    { label: "Paid Revenue", value: currency(paidRevenue), note: "Confirmed paid invoices" },
    { label: "Pending Payments", value: currency(pendingBalance), note: "Open invoice balances" },
    { label: "Unread Notifications", value: String(unreadNotifications ?? 0), note: "Admin action items" },
  ];
  const stages = Object.entries(statusCounts).map(([status, value]) => ({
    label: status.replace(/_/g, " "),
    value,
    color: statusColors[status] ?? "#d4a3af",
  }));
  const projectRows = (projects ?? []).map((project) => ({
    client: project.event_name,
    eventType: project.event_type,
    eventDate: project.event_date ?? "",
    status: project.status.replace(/_/g, " "),
    payment: "Synced",
    total: project.budget ?? "TBD",
  }));

  return (
    <div>
      <div className="dashboard-topbar">
        <h1>Dashboard Overview</h1>
        <div className="topbar-actions">
          <button className="icon-btn" aria-label="Notifications"><Bell size={17} /></button>
          <ButtonLink href="/admin/proposals/new"><Plus size={16} /> New</ButtonLink>
        </div>
      </div>
      <DashboardStats stats={stats} />
      <div className="dashboard-grid">
        <RevenueChart />
        <LeadPipeline stages={stages} total={leadRows.length} />
        <InventoryCalendar />
        <ProposalBuilder />
        <section className="panel">
          <h2>Today's Tasks</h2>
          <ul className="list">
            {tasks.map((task) => (
              <li key={task}>{task}<span className="mini-meta">Today</span></li>
            ))}
          </ul>
        </section>
        <ProjectTable rows={projectRows} />
      </div>
    </div>
  );
}

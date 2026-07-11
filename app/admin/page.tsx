import { Bell, Plus } from "lucide-react";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { InventoryCalendar } from "@/components/admin/InventoryCalendar";
import { LeadPipeline } from "@/components/admin/LeadPipeline";
import { ProjectTable } from "@/components/admin/ProjectTable";
import { ProposalBuilder } from "@/components/admin/ProposalBuilder";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { ButtonLink } from "@/components/ui/button";
import { tasks } from "@/lib/data";

export default function AdminDashboardPage() {
  return (
    <div>
      <div className="dashboard-topbar">
        <h1>Dashboard Overview</h1>
        <div className="topbar-actions">
          <button className="icon-btn" aria-label="Notifications"><Bell size={17} /></button>
          <ButtonLink href="/admin/proposals/new"><Plus size={16} /> New</ButtonLink>
        </div>
      </div>
      <DashboardStats />
      <div className="dashboard-grid">
        <RevenueChart />
        <LeadPipeline />
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
        <ProjectTable />
      </div>
    </div>
  );
}

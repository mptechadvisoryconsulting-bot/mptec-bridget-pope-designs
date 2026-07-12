import { CalendarDays, FileSignature, ListChecks, Package, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const iconMap = {
  people: Users,
  calendar: CalendarDays,
  tasks: ListChecks,
  inventory: Package,
  proposal: FileSignature,
};

export function AdminSectionPage({
  title,
  eyebrow,
  icon = "proposal",
}: {
  title: string;
  eyebrow: string;
  icon?: keyof typeof iconMap;
}) {
  const Icon = iconMap[icon];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        <ButtonLink href="/admin/clients">Create Client</ButtonLink>
      </div>
      <div className="placeholder-grid">
        <section className="placeholder-hero">
          <Icon color="var(--blush)" size={34} />
          <h1>{title}</h1>
          <p className="mini-meta">No synced records are available for this workspace yet.</p>
        </section>
        <section className="panel">
          <h2>Source of Truth</h2>
          <ul className="list">
            <li><span>Leads</span><a href="/admin/leads">Open CRM</a></li>
            <li><span>Clients</span><a href="/admin/clients">Manage Accounts</a></li>
            <li><span>Invoices</span><a href="/admin/invoices">Open Billing</a></li>
          </ul>
        </section>
        <section className="panel">
          <h2>Empty State</h2>
          <p className="mini-meta">Create or sync records before this area displays data.</p>
        </section>
        <section className="panel">
          <h2>Automation</h2>
          <p className="mini-meta">Related reminders, notifications, and activity logs will appear when live records exist.</p>
        </section>
      </div>
    </div>
  );
}

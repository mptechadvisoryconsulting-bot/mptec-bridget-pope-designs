import { CalendarDays, FileSignature, ListChecks, Package, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { bookings, tasks, upcomingEvents } from "@/lib/data";

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
        <ButtonLink href="/admin/proposals/new">New</ButtonLink>
      </div>
      <div className="placeholder-grid">
        <section className="placeholder-hero">
          <Icon color="var(--blush)" size={34} />
          <h1>{title}</h1>
          <p className="mini-meta">
            Operational workspace for Bridget Pope Designs. This route is ready to connect to Supabase, role-based permissions,
            activity logs, and automation records.
          </p>
        </section>
        <section className="panel">
          <h2>Active Queue</h2>
          <ul className="list">
            {tasks.slice(0, 4).map((task) => (
              <li key={task}>{task}<span className="status">Open</span></li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Recent Records</h2>
          <ul className="list">
            {bookings.slice(0, 3).map((booking) => (
              <li key={booking.client}>
                <span>{booking.client}</span>
                <span className="mini-meta">{booking.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Calendar Holds</h2>
          <ul className="list">
            {upcomingEvents.map((event) => (
              <li key={event.name}>
                <span>{event.name}</span>
                <span className="mini-meta">{event.date}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

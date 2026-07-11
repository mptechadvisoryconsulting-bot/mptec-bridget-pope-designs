import { adminStats } from "@/lib/data";

type Stat = {
  label: string;
  value: string;
  note: string;
};

export function DashboardStats({ stats = adminStats }: { stats?: Stat[] }) {
  return (
    <section className="stats-grid" aria-label="Admin statistics">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.note}</small>
        </article>
      ))}
    </section>
  );
}

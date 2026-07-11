import { adminStats } from "@/lib/data";

export function DashboardStats() {
  return (
    <section className="stats-grid" aria-label="Admin statistics">
      {adminStats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.note}</small>
        </article>
      ))}
    </section>
  );
}

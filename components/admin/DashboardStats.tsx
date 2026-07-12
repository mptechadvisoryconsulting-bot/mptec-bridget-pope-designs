type Stat = {
  label: string;
  value: string;
  note: string;
};

export function DashboardStats({ stats = [] }: { stats?: Stat[] }) {
  return (
    <section className="stats-grid" aria-label="Admin statistics">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.note}</small>
        </article>
      ))}
      {!stats.length ? <article className="stat-card"><span>Dashboard</span><strong>0</strong><small>No synced metrics yet.</small></article> : null}
    </section>
  );
}

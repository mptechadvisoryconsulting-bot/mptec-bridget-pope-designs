type RevenueRow = {
  label: string;
  value: number;
  amount: string;
};

export function RevenueChart({ rows = [] }: { rows?: RevenueRow[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="panel span-2">
      <h2>Revenue Overview</h2>
      <div className="chart">
        {rows.map((row) => (
          <div className="chart-row" key={row.label}>
            <span className="mini-meta">{row.label}</span>
            <div className="chart-track">
              <div className="chart-fill" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
            </div>
            <strong>{row.amount}</strong>
          </div>
        ))}
        {!rows.length ? (
          <div className="chart-row">
            <span className="mini-meta">No paid invoices yet.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

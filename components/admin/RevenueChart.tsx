const revenue = [
  ["May 1", 38],
  ["May 8", 55],
  ["May 15", 72],
  ["May 22", 66],
  ["May 29", 86],
];

export function RevenueChart() {
  return (
    <section className="panel span-2">
      <h2>Revenue Overview</h2>
      <div className="chart">
        {revenue.map(([label, value]) => (
          <div className="chart-row" key={label}>
            <span className="mini-meta">{label}</span>
            <div className="chart-track">
              <div className="chart-fill" style={{ width: `${value}%` }} />
            </div>
            <strong>{value}%</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

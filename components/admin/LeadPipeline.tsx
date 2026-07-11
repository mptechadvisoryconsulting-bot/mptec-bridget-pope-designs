import { pipeline } from "@/lib/data";

export function LeadPipeline() {
  return (
    <section className="panel">
      <h2>Bookings by Status</h2>
      <div className="donut-wrap">
        <div className="donut">
          <strong>18</strong>
        </div>
        <ul className="list">
          {pipeline.map((stage) => (
            <li key={stage.label}>
              <span style={{ alignItems: "center", display: "inline-flex", gap: 8 }}>
                <span style={{ background: stage.color, borderRadius: 99, display: "inline-block", height: 8, width: 8 }} />
                {stage.label}
              </span>
              <strong>{stage.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

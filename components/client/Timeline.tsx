import { timelineItems } from "@/lib/data";

export function Timeline() {
  return (
    <section className="panel">
      <h2>Timeline</h2>
      <div className="timeline-list">
        {timelineItems.map((item) => (
          <div className="timeline-item" key={item.title}>
            <strong>{item.title}</strong>
            <p className="mini-meta">{item.date} - {item.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

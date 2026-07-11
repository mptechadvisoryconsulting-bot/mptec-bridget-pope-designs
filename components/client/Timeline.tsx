type TimelineItem = {
  title: string;
  date: string;
  status: string;
};

export function Timeline({ items = [] }: { items?: TimelineItem[] }) {
  return (
    <section className="panel">
      <h2>Timeline</h2>
      <div className="timeline-list">
        {items.map((item) => (
          <div className="timeline-item" key={item.title}>
            <strong>{item.title}</strong>
            <p className="mini-meta">{item.date} - {item.status}</p>
          </div>
        ))}
        {!items.length ? <p className="mini-meta">No timeline milestones have been shared yet.</p> : null}
      </div>
    </section>
  );
}

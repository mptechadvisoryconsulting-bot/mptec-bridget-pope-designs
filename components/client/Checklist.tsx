import { CheckCircle2, Circle } from "lucide-react";

type ChecklistItem = {
  label: string;
  done: boolean;
};

export function Checklist({ items = [] }: { items?: ChecklistItem[] }) {
  return (
    <section className="panel">
      <h2>Checklist</h2>
      <div className="checklist">
        {items.map((item) => (
          <div className="check-row" key={item.label}>
            {item.done ? <CheckCircle2 color="var(--blush)" size={18} /> : <Circle color="#c9b9bd" size={18} />}
            <span>{item.label}</span>
          </div>
        ))}
        {!items.length ? <p className="mini-meta">No checklist items have been assigned yet.</p> : null}
      </div>
    </section>
  );
}

import { CheckCircle2, Circle } from "lucide-react";
import { checklistItems } from "@/lib/data";

export function Checklist() {
  return (
    <section className="panel">
      <h2>Checklist</h2>
      <div className="checklist">
        {checklistItems.map((item) => (
          <div className="check-row" key={item.label}>
            {item.done ? <CheckCircle2 color="var(--blush)" size={18} /> : <Circle color="#c9b9bd" size={18} />}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

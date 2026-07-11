import { CalendarDays, Check, CreditCard, FileSignature, Sparkles } from "lucide-react";
import { clientProgress } from "@/lib/data";

const icons = [FileSignature, Check, CreditCard, Sparkles, CreditCard, CalendarDays];

export function EventProgress() {
  return (
    <section className="card progress-card">
      <h2 className="eyebrow" style={{ margin: 0 }}>Progress Overview</h2>
      <div className="progress-line">
        {clientProgress.map((step, index) => {
          const Icon = icons[index];
          const className = index < 3 ? "progress-step done" : index === 3 ? "progress-step active" : "progress-step";
          return (
            <div className={className} key={step.label}>
              <span className="progress-dot">
                <Icon size={16} />
              </span>
              <strong>{step.label}</strong>
              <span className="mini-meta">{step.status}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

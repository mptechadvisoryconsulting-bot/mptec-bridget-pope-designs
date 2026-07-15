import { CalendarDays, Check, Image, MessageSquare, Palette, Sparkles } from "lucide-react";

const icons = [Check, MessageSquare, Palette, Image, Sparkles, CalendarDays];
const labels = ["Consultation", "Project Setup", "Design", "Client Feedback", "Final Details", "Event Day"];

const statusIndex: Record<string, number> = {
  pending: 0,
  booked: 1,
  planning: 2,
  design_in_progress: 2,
  awaiting_client_approval: 3,
  finalizing: 4,
  ready_for_event: 5,
  event_complete: 5,
};

export function EventProgress({ status = "pending" }: { status?: string }) {
  const activeIndex = statusIndex[status] ?? 0;

  return (
    <section className="card progress-card">
      <h2 className="eyebrow" style={{ margin: 0 }}>Progress Overview</h2>
      <div className="progress-line">
        {labels.map((label, index) => {
          const Icon = icons[index];
          const className = index < activeIndex ? "progress-step done" : index === activeIndex ? "progress-step active" : "progress-step";
          return (
            <div className={className} key={label}>
              <span className="progress-dot">
                <Icon size={16} />
              </span>
              <strong>{label}</strong>
              <span className="mini-meta">{index < activeIndex ? "Complete" : index === activeIndex ? status.replace(/_/g, " ") : "Upcoming"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

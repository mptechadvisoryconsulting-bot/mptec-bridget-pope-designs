import { CalendarCheck } from "lucide-react";
import { upcomingEvents } from "@/lib/data";
import { shortDate } from "@/lib/dates";

export function InventoryCalendar() {
  return (
    <section className="panel">
      <h2>Upcoming Events</h2>
      <ul className="list">
        {upcomingEvents.map((event) => (
          <li key={event.name}>
            <span style={{ alignItems: "center", display: "inline-flex", gap: 10 }}>
              <CalendarCheck color="var(--blush)" size={18} />
              <span>
                <strong style={{ display: "block" }}>{event.name}</strong>
                <span className="mini-meta">{shortDate(event.date)} - {event.location}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

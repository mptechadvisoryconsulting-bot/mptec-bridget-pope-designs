import { CalendarCheck } from "lucide-react";
import { shortDate } from "@/lib/dates";

type UpcomingEvent = {
  name: string;
  date: string;
  location: string;
};

export function InventoryCalendar({ events = [] }: { events?: UpcomingEvent[] }) {
  return (
    <section className="panel">
      <h2>Upcoming Events</h2>
      <ul className="list">
        {events.map((event) => (
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
        {!events.length ? <li>No upcoming events scheduled.</li> : null}
      </ul>
    </section>
  );
}

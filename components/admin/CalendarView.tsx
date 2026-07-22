"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, CalendarHeart, ListChecks } from "lucide-react";
import { MonthCalendar, type CalendarAgendaItem } from "@/components/admin/MonthCalendar";
import { formatDateTime } from "@/lib/dates";

const icons: Record<CalendarAgendaItem["kind"], typeof CalendarDays> = {
  consultation: CalendarClock,
  event: CalendarHeart,
  task: ListChecks,
  custom: CalendarDays,
};

function AgendaList({ entries }: { entries: CalendarAgendaItem[] }) {
  return (
    <ul className="list">
      {entries.map((item) => {
        const Icon = icons[item.kind];
        return (
          <li key={item.id}>
            <span style={{ alignItems: "center", display: "inline-flex", gap: 10 }}>
              <Icon color="var(--blush)" size={18} />
              <span>
                <strong style={{ display: "block" }}>{item.title}</strong>
                <span className="mini-meta">
                  {formatDateTime(item.at)} · {item.detail}
                </span>
              </span>
            </span>
          </li>
        );
      })}
      {!entries.length ? <li>Nothing scheduled.</li> : null}
    </ul>
  );
}

export function CalendarView({ items }: { items: CalendarAgendaItem[] }) {
  const [mode, setMode] = useState<"month" | "list">("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const weekFromNow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }, []);

  const thisWeek = items.filter((item) => new Date(item.at) <= weekFromNow);
  const later = items.filter((item) => new Date(item.at) > weekFromNow);

  return (
    <div>
      <div className="topbar-actions" style={{ marginBottom: 16 }}>
        <button
          className={mode === "month" ? "btn btn-primary" : "btn btn-light"}
          type="button"
          onClick={() => setMode("month")}
        >
          Month
        </button>
        <button
          className={mode === "list" ? "btn btn-primary" : "btn btn-light"}
          type="button"
          onClick={() => setMode("list")}
        >
          List
        </button>
      </div>

      {mode === "month" ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Month view</h2>
            <span className="status">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <MonthCalendar items={items} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="panel span-2">
            <div className="section-heading">
              <h2>This Week</h2>
              <span className="status">
                {thisWeek.length} item{thisWeek.length === 1 ? "" : "s"}
              </span>
            </div>
            <AgendaList entries={thisWeek} />
          </section>
          <section className="panel">
            <h2>Looking Ahead</h2>
            <AgendaList entries={later.slice(0, 10)} />
          </section>
        </div>
      )}
    </div>
  );
}

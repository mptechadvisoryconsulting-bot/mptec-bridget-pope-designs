"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type CalendarAgendaItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: "consultation" | "event" | "task" | "custom";
};

const kindColors: Record<CalendarAgendaItem["kind"], string> = {
  consultation: "var(--blush, #d6758e)",
  event: "#6b8f71",
  task: "#8a6d3b",
  custom: "#5c6b8a",
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function MonthCalendar({
  items,
  busyDates,
  onSelectDay,
  selectedDay,
  compact = false,
}: {
  items?: CalendarAgendaItem[];
  busyDates?: string[];
  onSelectDay?: (day: Date) => void;
  selectedDay?: Date | null;
  compact?: boolean;
}) {
  const [month, setMonth] = useState(() => startOfMonth(selectedDay ?? new Date()));

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarAgendaItem[]>();
    for (const item of items ?? []) {
      const key = dayKey(new Date(item.at));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const busyDaySet = useMemo(() => {
    const set = new Set<string>();
    for (const value of busyDates ?? []) {
      set.add(dayKey(new Date(value)));
    }
    for (const key of itemsByDay.keys()) {
      set.add(key);
    }
    return set;
  }, [busyDates, itemsByDay]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedKey = selectedDay ? dayKey(selectedDay) : null;
  const selectedItems = selectedKey ? itemsByDay.get(selectedKey) ?? [] : [];

  return (
    <div className={compact ? "month-calendar month-calendar-compact" : "month-calendar"}>
      <div className="month-calendar-toolbar">
        <button className="btn btn-light" type="button" onClick={() => setMonth((current) => addMonths(current, -1))}>
          Prev
        </button>
        <strong>{format(month, "MMMM yyyy")}</strong>
        <button className="btn btn-light" type="button" onClick={() => setMonth((current) => addMonths(current, 1))}>
          Next
        </button>
      </div>

      <div className="month-calendar-weekdays" aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="month-calendar-grid" role="grid" aria-label={`Calendar for ${format(month, "MMMM yyyy")}`}>
        {days.map((day) => {
          const key = dayKey(day);
          const dayItems = itemsByDay.get(key) ?? [];
          const isBusy = busyDaySet.has(key);
          const inMonth = isSameMonth(day, month);
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={key}
              type="button"
              className={[
                "month-calendar-day",
                inMonth ? "" : "outside",
                isBusy ? "busy" : "",
                isSelected ? "selected" : "",
                isToday ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDay?.(day)}
              aria-pressed={isSelected}
              aria-label={`${format(day, "MMMM d, yyyy")}${isBusy ? ", has bookings" : ""}`}
            >
              <span className="month-calendar-day-number">{format(day, "d")}</span>
              {!compact && dayItems.length ? (
                <ul className="month-calendar-day-items">
                  {dayItems.slice(0, 3).map((item) => (
                    <li key={item.id} style={{ borderLeftColor: kindColors[item.kind] }} title={item.detail}>
                      {item.title}
                    </li>
                  ))}
                  {dayItems.length > 3 ? <li className="more">+{dayItems.length - 3} more</li> : null}
                </ul>
              ) : null}
              {compact && isBusy ? <span className="month-calendar-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      {!compact && selectedDay ? (
        <div className="month-calendar-day-detail">
          <h3>{format(selectedDay, "EEEE, MMM d")}</h3>
          {selectedItems.length ? (
            <ul className="list">
              {selectedItems.map((item) => (
                <li key={item.id}>
                  <strong style={{ display: "block" }}>{item.title}</strong>
                  <span className="mini-meta">
                    {format(new Date(item.at), "h:mm a")} · {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mini-meta">Nothing booked this day.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

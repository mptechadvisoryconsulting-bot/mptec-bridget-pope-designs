"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MonthCalendar } from "@/components/admin/MonthCalendar";

export function ScheduleAvailability({ busyDates }: { busyDates: string[] }) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const selectedCount = selectedDay
    ? busyDates.filter((value) => format(new Date(value), "yyyy-MM-dd") === format(selectedDay, "yyyy-MM-dd")).length
    : 0;

  return (
    <section className="panel span-2">
      <div className="section-heading">
        <h2>Availability</h2>
        <span className="status">Busy days highlighted</span>
      </div>
      <p className="mini-meta">
        Use this month grid when picking a consultation time below. Days with existing consultations are marked.
      </p>
      <MonthCalendar
        busyDates={busyDates}
        compact
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />
      {selectedDay ? (
        <p className="mini-meta" style={{ marginTop: 12 }}>
          {format(selectedDay, "EEEE, MMM d")}:{" "}
          {selectedCount ? `${selectedCount} consultation${selectedCount === 1 ? "" : "s"} already booked` : "Looks open"}
        </p>
      ) : null}
    </section>
  );
}

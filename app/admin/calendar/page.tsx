import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function CalendarPage() {
  return <AdminResourcePage eyebrow="Scheduling" title="Calendar" table="calendar_events" columns={["title", "event_type", "starts_at", "ends_at", "location", "created_at"]} />;
}

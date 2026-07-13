import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function CalendarPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Scheduling"
      title="Calendar"
      description="Owner and team schedule entries for consultations, installs, event days, and reminders."
      table="calendar_events"
      columns={[
        { key: "title", label: "Event" },
        { key: "event_type", label: "Type", format: "status" },
        { key: "starts_at", label: "Starts", format: "datetime" },
        { key: "ends_at", label: "Ends", format: "datetime" },
        { key: "location", label: "Location" },
      ]}
      emptyTitle="No calendar events"
      emptyDescription="Consultations, installs, and event reminders will appear here as they are scheduled."
    />
  );
}

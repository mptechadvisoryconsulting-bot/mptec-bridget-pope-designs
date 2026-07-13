import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function ProjectsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Production"
      title="Projects"
      description="Track booked and planning events that sync to each client portal."
      table="projects"
      detailBaseHref="/admin/projects"
      columns={[
        { key: "project_number", label: "Project" },
        { key: "event_name", label: "Event" },
        { key: "event_type", label: "Type" },
        { key: "event_date", label: "Date", format: "date" },
        { key: "venue_name", label: "Venue" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="No active projects"
      emptyDescription="Converted clients and booked events will appear here with shared project IDs."
    />
  );
}

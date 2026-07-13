import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function TasksPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Operations"
      title="Tasks"
      description="Open project and follow-up tasks for owner/admin execution."
      table="tasks"
      columns={[
        { key: "title", label: "Task" },
        { key: "description", label: "Notes" },
        { key: "due_date", label: "Due", format: "date" },
        { key: "priority", label: "Priority", format: "status" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="No open tasks"
      emptyDescription="Follow-ups, consultation reminders, and project tasks will sync here."
    />
  );
}

import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function TasksPage() {
  return <AdminResourcePage eyebrow="Operations" title="Tasks" table="tasks" columns={["title", "description", "due_date", "priority", "status", "created_at"]} />;
}

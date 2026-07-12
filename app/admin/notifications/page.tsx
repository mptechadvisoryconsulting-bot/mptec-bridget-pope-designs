import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function AdminNotificationsPage() {
  return <AdminResourcePage eyebrow="Realtime" title="Notifications" table="notifications" columns={["type", "title", "message", "action_url", "read_at", "created_at"]} />;
}

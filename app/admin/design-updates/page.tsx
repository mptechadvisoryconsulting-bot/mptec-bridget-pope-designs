import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function AdminDesignUpdatesPage() {
  return <AdminResourcePage eyebrow="Creative" title="Design Updates" table="design_updates" columns={["title", "description", "status", "client_visible", "created_at"]} />;
}

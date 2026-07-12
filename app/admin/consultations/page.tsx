import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function ConsultationsPage() {
  return <AdminResourcePage eyebrow="Scheduling" title="Consultations" table="consultations" columns={["scheduled_at", "meeting_type", "meeting_link", "status", "notes", "created_at"]} />;
}

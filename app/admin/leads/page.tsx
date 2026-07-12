import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function LeadsPage() {
  return <AdminResourcePage eyebrow="CRM" title="Leads" table="leads" detailBaseHref="/admin/leads" columns={["first_name", "last_name", "email", "event_type", "status", "created_at"]} />;
}

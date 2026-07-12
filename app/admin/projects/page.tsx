import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function ProjectsPage() {
  return <AdminResourcePage eyebrow="Production" title="Projects" table="projects" detailBaseHref="/admin/projects" columns={["event_name", "event_type", "event_date", "venue_name", "status", "created_at"]} />;
}

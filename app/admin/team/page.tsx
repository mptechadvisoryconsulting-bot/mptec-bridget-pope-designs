import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function TeamPage() {
  return <AdminResourcePage eyebrow="Users" title="Team" table="profiles" columns={["first_name", "last_name", "email", "username", "role", "active"]} />;
}

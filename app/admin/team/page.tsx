import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function TeamPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Users"
      title="Team"
      description="Owner, admin, planner, team member, and client profiles with active account state."
      table="profiles"
      columns={[
        { key: "first_name", label: "First Name" },
        { key: "last_name", label: "Last Name" },
        { key: "email", label: "Email" },
        { key: "username", label: "Username" },
        { key: "role", label: "Role", format: "status" },
        { key: "active", label: "Active", format: "boolean" },
      ]}
      emptyTitle="No profiles"
      emptyDescription="Owner and client accounts will appear here after setup."
    />
  );
}

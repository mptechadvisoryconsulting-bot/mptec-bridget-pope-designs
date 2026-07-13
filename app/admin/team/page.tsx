import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  planner: "Planner",
  team_member: "Team Member",
  client: "Client",
};

export default async function TeamPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,email,role,active,created_at")
    .in("role", ["owner", "admin", "planner", "team_member"])
    .order("role", { ascending: true });

  const team = (data ?? []) as TeamRow[];
  const activeCount = team.filter((member) => member.active).length;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Users</span>
          <h1>Team</h1>
          <p className="mini-meta">Owner, admin, planner, and team member accounts with active status.</p>
        </div>
      </div>

      <section className="panel">
        <h2>{team.length} Team Member{team.length === 1 ? "" : "s"} · {activeCount} Active</h2>
        <table className="table">
          <thead>
            <tr><th>Member</th><th>Email</th><th>Role</th><th>Status</th></tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id}>
                <td>{member.first_name} {member.last_name}</td>
                <td>{member.email}</td>
                <td><span className="status">{roleLabels[member.role] ?? member.role}</span></td>
                <td><span className="status">{member.active ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}
            {!team.length ? (
              <tr>
                <td colSpan={4}>
                  <strong>No team profiles</strong>
                  <div className="mini-meta">Owner and staff accounts will appear here after setup.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

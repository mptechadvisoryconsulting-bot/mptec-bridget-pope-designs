import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { projectStatusLabels, projectStatuses } from "@/lib/admin/constants";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };

type ProjectRow = {
  id: string;
  project_number: string;
  event_name: string;
  event_type: string;
  event_date?: string | null;
  venue_name?: string | null;
  status: string;
  bpd_clients?: ClientRef | ClientRef[] | null;
};

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string; status?: string }> }) {
  const { action, id, status } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "status" && id && status) {
    await supabase.from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("activity_logs").insert({ actor_id: profile?.id ?? null, project_id: id, action: "project_status_updated", entity_type: "project", entity_id: id, metadata: { status } });
    redirect("/admin/projects");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id,project_number,event_name,event_type,event_date,venue_name,status,bpd_clients!client_id(bpd_profiles(first_name,last_name))")
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(100);

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  const [{ data: openTasks }, { data: openInvoices }] = await Promise.all([
    projectIds.length
      ? supabase.from("tasks").select("id,project_id").in("project_id", projectIds).neq("status", "complete")
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase
          .from("invoices")
          .select("project_id,balance_due")
          .in("project_id", projectIds)
          .gt("balance_due", 0)
      : Promise.resolve({ data: [] }),
  ]);

  const taskCounts = new Map<string, number>();
  for (const task of openTasks ?? []) {
    taskCounts.set(task.project_id, (taskCounts.get(task.project_id) ?? 0) + 1);
  }

  const balanceByProject = new Map<string, number>();
  for (const invoice of openInvoices ?? []) {
    balanceByProject.set(invoice.project_id, (balanceByProject.get(invoice.project_id) ?? 0) + Number(invoice.balance_due ?? 0));
  }

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Production</span>
          <h1>Projects</h1>
          <p className="mini-meta">Track booked and planning events that sync to each client portal.</p>
        </div>
      </div>

      <section className="panel">
        <h2>{projectRows.length} Project{projectRows.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Event</th>
              <th>Date</th>
              <th>Venue</th>
              <th>Status</th>
              <th>Open Tasks</th>
              <th>Invoice Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projectRows.map((project) => {
              const client = first(project.bpd_clients);
              const clientProfile = first(client?.bpd_profiles);
              const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "Client";
              const balance = balanceByProject.get(project.id) ?? 0;

              return (
                <tr key={project.id}>
                  <td>{clientName}</td>
                  <td><a href={`/admin/projects/${project.id}`}>{project.event_name}</a><div className="mini-meta">{project.event_type}</div></td>
                  <td>{formatDate(project.event_date, "Date pending")}</td>
                  <td>{project.venue_name || "Not set"}</td>
                  <td>
                    <form action="/admin/projects" method="get" style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="action" value="status" />
                      <input type="hidden" name="id" value={project.id} />
                      <select className="input" defaultValue={project.status} name="status" style={{ padding: "6px 8px" }}>
                        {projectStatuses.map((option) => (
                          <option key={option} value={option}>{projectStatusLabels[option]}</option>
                        ))}
                      </select>
                      <button className="btn btn-light" type="submit">Update</button>
                    </form>
                  </td>
                  <td>{taskCounts.get(project.id) ?? 0}</td>
                  <td>{balance > 0 ? currency(balance) : "No balance reference"}</td>
                  <td><ButtonLink href={`/admin/projects/${project.id}`} variant="light">Open</ButtonLink></td>
                </tr>
              );
            })}
            {!projectRows.length ? (
              <tr>
                <td colSpan={8}>
                  <strong>No active projects</strong>
                  <div className="mini-meta">Converted clients and booked events will appear here with shared project IDs.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { completeTask, reopenTask } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type ProjectRef = { event_name?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: string;
  status: string;
  project_id?: string | null;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string; filter?: string }> }) {
  const { action, id, filter } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action && id) {
    if (action === "complete") await completeTask(supabase, id, profile?.id);
    if (action === "reopen") await reopenTask(supabase, id, profile?.id);
    redirect(filter ? `/admin/tasks?filter=${filter}` : "/admin/tasks");
  }

  let query = supabase
    .from("tasks")
    .select("id,title,description,due_date,priority,status,project_id,bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name)))")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(150);

  if (filter === "open") query = query.neq("status", "complete");
  if (filter === "complete") query = query.eq("status", "complete");

  const { data } = await query;
  const tasks = (data ?? []) as TaskRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Operations</span>
          <h1>Tasks</h1>
          <p className="mini-meta">Open project and follow-up tasks for owner/admin execution.</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/tasks" variant={!filter ? "primary" : "light"}>All</ButtonLink>
          <ButtonLink href="/admin/tasks?filter=open" variant={filter === "open" ? "primary" : "light"}>Open</ButtonLink>
          <ButtonLink href="/admin/tasks?filter=complete" variant={filter === "complete" ? "primary" : "light"}>Complete</ButtonLink>
        </div>
      </div>

      <section className="panel">
        <h2>{tasks.length} Task{tasks.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Client</th>
              <th>Due</th>
              <th>Priority</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const project = first(task.bpd_projects);
              const client = first(project?.bpd_clients);
              const clientProfile = first(client?.bpd_profiles);
              const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "—";
              const isComplete = task.status === "complete";

              return (
                <tr key={task.id}>
                  <td>{task.title}{task.description ? <div className="mini-meta">{task.description}</div> : null}</td>
                  <td>{task.project_id ? <a href={`/admin/projects/${task.project_id}`}>{project?.event_name ?? "Project"}</a> : "General"}</td>
                  <td>{clientName}</td>
                  <td>{formatDate(task.due_date, "No due date")}</td>
                  <td><span className="status">{task.priority}</span></td>
                  <td><span className="status">{isComplete ? "Complete" : "Open"}</span></td>
                  <td>
                    <ButtonLink href={`/admin/tasks?action=${isComplete ? "reopen" : "complete"}&id=${task.id}${filter ? `&filter=${filter}` : ""}`} variant="light">
                      {isComplete ? "Reopen" : "Complete"}
                    </ButtonLink>
                  </td>
                </tr>
              );
            })}
            {!tasks.length ? (
              <tr>
                <td colSpan={7}>
                  <strong>No open tasks</strong>
                  <div className="mini-meta">Follow-ups, consultation reminders, and project tasks will sync here.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

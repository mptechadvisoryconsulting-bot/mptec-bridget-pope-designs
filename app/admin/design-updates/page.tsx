import { redirect } from "next/navigation";
import { DesignUpdateCreateForm } from "@/components/admin/DesignUpdateCreateForm";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { sendDesignUpdate } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type ProjectRef = { event_name?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type DesignUpdateRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  project_id: string;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  shared: "Shared",
  awaiting_feedback: "Awaiting Feedback",
  approved: "Approved",
  revision_requested: "Revision Requested",
};

export default async function DesignUpdatesPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string }> }) {
  const { action, id } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "send" && id) {
    await sendDesignUpdate(supabase, id, profile?.id);
    redirect("/admin/design-updates");
  }

  const [{ data }, { data: projects }] = await Promise.all([
    supabase
      .from("design_updates")
      .select("id,title,description,status,client_visible,created_at,updated_at,project_id,bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name)))")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("projects").select("id,event_name").order("created_at", { ascending: false }).limit(100),
  ]);

  const updates = (data ?? []) as DesignUpdateRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Creative</span>
          <h1>Design Updates</h1>
          <p className="mini-meta">Client-visible design progress, mood board notes, and internal creative status.</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <DesignUpdateCreateForm projects={projects ?? []} />
      </div>

      <section className="panel">
        <h2>
          {updates.length} Update{updates.length === 1 ? "" : "s"}
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th>Update</th>
              <th>Project</th>
              <th>Client</th>
              <th>Status</th>
              <th>Sent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {updates.map((update) => {
              const project = first(update.bpd_projects);
              const client = first(project?.bpd_clients);
              const clientProfile = first(client?.bpd_profiles);
              const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "Client";

              return (
                <tr key={update.id}>
                  <td>
                    {update.title}
                    {update.description ? <div className="mini-meta">{update.description}</div> : null}
                  </td>
                  <td>{project?.event_name ?? "Project"}</td>
                  <td>{clientName}</td>
                  <td>
                    <span className="status">{statusLabels[update.status] ?? update.status}</span>
                  </td>
                  <td>{update.client_visible ? formatDateTime(update.updated_at) : "Not sent"}</td>
                  <td>
                    <div className="topbar-actions">
                      <ButtonLink href={`/admin/projects/${update.project_id}`} variant="light">
                        Open
                      </ButtonLink>
                      {!update.client_visible ? (
                        <ButtonLink href={`/admin/design-updates?action=send&id=${update.id}`} variant="light">
                          Send
                        </ButtonLink>
                      ) : null}
                      <ButtonLink href="/admin/messages" variant="light">
                        Message
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!updates.length ? (
              <tr>
                <td colSpan={6}>
                  <strong>No design updates</strong>
                  <div className="mini-meta">Shared design notes will appear in the matching client portal when marked client visible.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

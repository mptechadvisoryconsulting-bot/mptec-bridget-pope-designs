import { ClientAccountManager } from "@/components/admin/ClientAccountManager";
import { ContactLinks } from "@/components/admin/ContactLinks";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean | null;
};

type ClientRow = {
  id: string;
  created_at?: string | null;
  bpd_profiles?: ProfileRow | ProfileRow[] | null;
};

type ProjectRow = {
  id: string;
  client_id: string;
  event_name: string;
  event_type: string;
  event_date?: string | null;
  status: string;
  created_at?: string | null;
  bpd_clients?: { bpd_profiles?: ProfileRow | ProfileRow[] | null } | Array<{ bpd_profiles?: ProfileRow | ProfileRow[] | null }> | null;
};

type PortalProject = {
  id: string;
  profileId: string;
  clientName: string;
  username: string;
  email: string;
  active: boolean;
  eventName: string;
  eventType: string;
  eventDate: string;
  status: string;
};

export default async function ClientsPage() {
  const supabase = createAdminClient();

  const [{ data: clientsData, error: clientsError }, { data: projectsData, error: projectsError }] = await Promise.all([
    supabase
      .from("clients")
      .select("id,billing_address,created_at,bpd_profiles(id,first_name,last_name,username,email,phone,active)")
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,client_id,event_name,event_type,event_date,status,created_at,bpd_clients(bpd_profiles(id,first_name,last_name,username,email,active))")
      .order("created_at", { ascending: false }),
  ]);

  if (clientsError) console.error("clients_roster_query_failed", clientsError);
  if (projectsError) console.error("clients_projects_query_failed", projectsError);

  const clients = (clientsData ?? []) as ClientRow[];
  const projects = (projectsData ?? []) as ProjectRow[];

  const projectsByClient = new Map<string, ProjectRow[]>();
  for (const project of projects) {
    if (!project.client_id) continue;
    const list = projectsByClient.get(project.client_id) ?? [];
    list.push(project);
    projectsByClient.set(project.client_id, list);
  }

  const roster = clients.map((client) => {
    const profile = first(client.bpd_profiles);
    const clientProjects = projectsByClient.get(client.id) ?? [];
    const latest = clientProjects[0];
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";
    const portalActive = profile?.active ?? false;

    return {
      id: client.id,
      name,
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      username: profile?.username ?? "",
      portalActive,
      projectCount: clientProjects.length,
      latestEvent: latest?.event_name ?? null,
      latestEventDate: latest?.event_date ?? null,
      latestStatus: latest?.status ?? null,
      createdAt: client.created_at ?? null,
    };
  });

  const portalProjects: PortalProject[] = projects.map((project) => {
    const client = first(project.bpd_clients);
    const profile = first(client?.bpd_profiles);
    const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";

    return {
      id: project.id,
      profileId: profile?.id ?? "",
      clientName,
      username: profile?.username ?? "Not set",
      email: profile?.email ?? "",
      active: profile?.active ?? true,
      eventName: project.event_name,
      eventType: project.event_type,
      eventDate: project.event_date ?? "",
      status: project.status,
    };
  });

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Client Management</span>
          <h1>Clients</h1>
          <p className="mini-meta">
            Client roster with contact info, projects, and portal status. Open a client for full details, invoices, and history.
          </p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="#invite-client" variant="secondary">
            Invite a client
          </ButtonLink>
        </div>
      </div>

      {clientsError ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <strong>Could not load clients</strong>
          <div className="mini-meta">{clientsError.message}</div>
        </section>
      ) : null}

      <section className="panel">
        <h2>
          {roster.length} Client{roster.length === 1 ? "" : "s"}
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Projects</th>
              <th>Latest event</th>
              <th>Portal</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((client) => (
              <tr key={client.id}>
                <td>
                  <a href={`/admin/clients/${client.id}`}>{client.name}</a>
                  {client.username ? <div className="mini-meta">@{client.username}</div> : null}
                </td>
                <td>
                  <ContactLinks email={client.email} phone={client.phone} />
                </td>
                <td>{client.projectCount}</td>
                <td>
                  {client.latestEvent || "No projects yet"}
                  <div className="mini-meta">
                    {formatDate(client.latestEventDate, "Date pending")}
                    {client.latestStatus ? ` · ${client.latestStatus.replace(/_/g, " ")}` : ""}
                  </div>
                </td>
                <td>
                  <span className="status">{client.portalActive ? "Active" : "Invited / inactive"}</span>
                </td>
              </tr>
            ))}
            {!roster.length ? (
              <tr>
                <td colSpan={5}>
                  <strong>No clients yet</strong>
                  <div className="mini-meta">
                    Convert a consultation request, or use Invite a client below to create a portal login.
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div id="invite-client" style={{ marginTop: 24 }}>
        <ClientAccountManager projects={portalProjects} />
      </div>
    </div>
  );
}

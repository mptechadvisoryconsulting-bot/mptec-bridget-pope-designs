import { ClientAccountManager } from "@/components/admin/ClientAccountManager";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  event_name: string;
  event_type: string;
  event_date?: string | null;
  status: string;
  bpd_clients?: {
    bpd_profiles?: {
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
    } | Array<{
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
    }> | null;
  } | Array<{
    bpd_profiles?: {
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
    } | Array<{
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
    }> | null;
  }> | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ClientsPage() {
  const { data } = await createAdminClient()
    .from("projects")
    .select("id,event_name,event_type,event_date,status,bpd_clients(bpd_profiles(first_name,last_name,username))")
    .order("created_at", { ascending: false });

  const projects = ((data ?? []) as ProjectRow[]).map((project) => {
    const client = first(project.bpd_clients);
    const profile = first(client?.bpd_profiles);
    const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";

    return {
      id: project.id,
      clientName,
      username: profile?.username ?? "Not set",
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
        </div>
      </div>
      <ClientAccountManager projects={projects} />
    </div>
  );
}

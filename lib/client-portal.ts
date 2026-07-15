import { redirect } from "next/navigation";
import { displayName, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClientPortalProject = {
  id: string;
  event_name: string;
  event_type?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  city?: string | null;
  status: string;
  created_at?: string | null;
};

export type ClientPortalContext = {
  profile: {
    id: string;
    role: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    username?: string | null;
  };
  client: { id: string; active_project_id?: string | null } | null;
  project: ClientPortalProject | null;
  projects: ClientPortalProject[];
};

export async function requireClientPortalContext(
  next = "/client/dashboard",
  options?: { projectId?: string | null },
): Promise<ClientPortalContext> {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  if (!profile.active || profile.role !== "client") {
    redirect(profile.role === "owner" || profile.role === "admin" ? "/admin" : "/auth/login?error=profile");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id,active_project_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { data: projects } = client?.id
    ? await supabase
        .from("projects")
        .select("id,event_name,event_type,event_date,venue_name,city,status,created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const projectList = (projects ?? []) as ClientPortalProject[];
  const requestedId = options?.projectId?.trim() || null;
  const activeId = client?.active_project_id ?? null;

  const project =
    (requestedId ? projectList.find((row) => row.id === requestedId) : null) ??
    (activeId ? projectList.find((row) => row.id === activeId) : null) ??
    projectList[0] ??
    null;

  return { profile, client: client ?? null, project, projects: projectList };
}

export function clientPortalName(context: ClientPortalContext) {
  return displayName(context.profile);
}

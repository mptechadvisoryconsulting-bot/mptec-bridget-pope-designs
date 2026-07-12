import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("proposals")
    .select("id,project_id,bpd_projects(assigned_admin_id,bpd_clients(profile_id))")
    .eq("id", proposalId)
    .maybeSingle();
  const project = Array.isArray(existing?.bpd_projects) ? existing?.bpd_projects[0] : existing?.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canApprove = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;

  if (!existing || !canApprove) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("proposals")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", proposalId)
    .select("id,project_id")
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  await supabase.from("activity_logs").insert({
    project_id: data.project_id,
    action: "proposal_approved",
    entity_type: "proposal",
    entity_id: data.id,
  });
  return NextResponse.json({ success: true, proposal: data });
}

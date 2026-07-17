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
  // Avoid nested embeds here: ambiguous PostgREST relationships on bpd_proposals→bpd_projects
  // previously returned HTTP 300, which surfaced as a false "Proposal not found" 404.
  const { data: existing } = await supabase.from("proposals").select("id,project_id").eq("id", proposalId).maybeSingle();
  if (!existing) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  let canApprove = adminRoles.has(profile.role);
  if (!canApprove) {
    const { data: project } = await supabase
      .from("projects")
      .select("assigned_admin_id,client_id")
      .eq("id", existing.project_id)
      .maybeSingle();
    if (project?.assigned_admin_id === profile.id) {
      canApprove = true;
    } else if (project?.client_id) {
      const { data: client } = await supabase.from("clients").select("profile_id").eq("id", project.client_id).maybeSingle();
      canApprove = client?.profile_id === profile.id;
    }
  }

  if (!canApprove) {
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

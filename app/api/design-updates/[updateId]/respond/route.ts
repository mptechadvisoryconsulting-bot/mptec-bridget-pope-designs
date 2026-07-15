import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

const responseSchema = z.object({
  action: z.enum(["approve", "request_changes"]),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function POST(request: Request, { params }: { params: Promise<{ updateId: string }> }) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active || profile.role !== "client") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { updateId } = await params;
  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid response." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: update } = await supabase
    .from("design_updates")
    .select("id,title,description,project_id,bpd_projects(assigned_admin_id,bpd_clients(id,profile_id))")
    .eq("id", updateId)
    .eq("client_visible", true)
    .maybeSingle();

  const project = Array.isArray(update?.bpd_projects) ? update?.bpd_projects[0] : update?.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;

  if (!update || client?.profile_id !== profile.id) {
    return NextResponse.json({ success: false, message: "Design update not found." }, { status: 404 });
  }

  const { data: latestVersion } = await supabase
    .from("design_versions")
    .select("id,version_number")
    .eq("design_update_id", update.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let versionId = latestVersion?.id;
  if (!versionId) {
    const { data: createdVersion, error: versionError } = await supabase
      .from("design_versions")
      .insert({
        design_update_id: update.id,
        project_id: update.project_id,
        version_number: 1,
        title: update.title,
        description: update.description,
      })
      .select("id")
      .single();
    if (versionError || !createdVersion) {
      return NextResponse.json({ success: false, message: versionError?.message ?? "Unable to create design version." }, { status: 400 });
    }
    versionId = createdVersion.id;
  }

  const response = parsed.data;
  if (response.action === "approve") {
    await supabase.from("design_approvals").insert({
      design_version_id: versionId,
      project_id: update.project_id,
      client_id: client.id,
    });
  } else {
    await supabase.from("design_feedback").insert({
      design_version_id: versionId,
      project_id: update.project_id,
      client_id: client.id,
      message: response.message || "Changes requested.",
    });
  }

  const nextStatus = response.action === "approve" ? "approved" : "revision_requested";
  await supabase
    .from("design_updates")
    .update({
      status: nextStatus,
      client_action_status: "completed",
      client_response: response.message || (response.action === "approve" ? "Approved" : "Changes requested"),
      client_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", update.id);

  if (project?.assigned_admin_id) {
    await supabase.from("notifications").insert({
      recipient_id: project.assigned_admin_id,
      project_id: update.project_id,
      type: response.action === "approve" ? "design_approved" : "design_feedback_received",
      title: response.action === "approve" ? "Design approved" : "Design feedback received",
      message: `${profile.first_name ?? "Client"} responded to ${update.title ?? "a design update"}.`,
      action_url: `/admin/projects/${update.project_id}`,
    });
  }

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    project_id: update.project_id,
    action: response.action === "approve" ? "design_approved" : "design_changes_requested",
    entity_type: "design_update",
    entity_id: update.id,
  });

  return NextResponse.json({ success: true, status: nextStatus });
}

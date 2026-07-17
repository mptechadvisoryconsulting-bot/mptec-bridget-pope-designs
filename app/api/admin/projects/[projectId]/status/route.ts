import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const statusSchema = z.object({
  status: z.enum(["pending", "booked", "planning", "design_in_progress", "awaiting_client_approval", "finalizing", "ready_for_event", "event_complete", "closed", "cancelled"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { projectId } = await params;
  const input = statusSchema.parse(await request.json());
  const supabase = createAdminClient();

  // Avoid nested bpd_clients embed: projects↔clients has two FKs (client_id +
  // active_project_id), so PostgREST returns HTTP 300 and this handler 404s.
  const { data: project, error } = await supabase
    .from("projects")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id,event_name,client_id")
    .single();

  if (error || !project) {
    return NextResponse.json({ success: false, message: error?.message ?? "Project not found." }, { status: 404 });
  }

  let clientProfileId: string | null | undefined;
  if (project.client_id) {
    const { data: client } = await supabase.from("clients").select("profile_id").eq("id", project.client_id).maybeSingle();
    clientProfileId = client?.profile_id;
  }

  if (clientProfileId) {
    await supabase.from("notifications").insert({
      recipient_id: clientProfileId,
      project_id: project.id,
      type: "project_status_updated",
      title: "Project status updated",
      message: `${project.event_name} is now ${input.status.replace(/_/g, " ")}.`,
      action_url: "/client/dashboard",
    });
  }

  return NextResponse.json({ success: true, project });
}

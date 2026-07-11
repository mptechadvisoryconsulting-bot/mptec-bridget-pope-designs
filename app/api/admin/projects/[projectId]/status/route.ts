import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const statusSchema = z.object({
  status: z.enum(["pending", "booked", "planning", "design_in_progress", "awaiting_client_approval", "finalizing", "ready_for_event", "event_complete", "closed", "cancelled"]),
});

type ProjectWithClient = {
  id: string;
  event_name: string;
  bpd_clients?: { profile_id?: string | null } | Array<{ profile_id?: string | null }> | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { projectId } = await params;
  const input = statusSchema.parse(await request.json());
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from("projects")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id,event_name,client_id,bpd_clients(profile_id)")
    .single();

  if (error || !project) {
    return NextResponse.json({ success: false, message: error?.message ?? "Project not found." }, { status: 404 });
  }

  const projectWithClient = project as ProjectWithClient;
  const clientProfileId = Array.isArray(projectWithClient.bpd_clients)
    ? projectWithClient.bpd_clients[0]?.profile_id
    : projectWithClient.bpd_clients?.profile_id;

  if (clientProfileId) {
    await supabase.from("notifications").insert({
      recipient_id: clientProfileId,
      project_id: projectWithClient.id,
      type: "project_status_updated",
      title: "Project status updated",
      message: `${projectWithClient.event_name} is now ${input.status.replace(/_/g, " ")}.`,
      action_url: "/client/dashboard",
    });
  }

  return NextResponse.json({ success: true, project });
}

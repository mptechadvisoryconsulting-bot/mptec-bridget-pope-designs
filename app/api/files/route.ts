import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { fileSchema } from "@/lib/validation/file-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const input = fileSchema.parse(await request.json());
  const supabase = createAdminClient();
  const isAdmin = adminRoles.has(profile.role);

  if ((input.leadId || input.visibility !== "client_upload") && !isAdmin) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  if (input.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id,assigned_admin_id,bpd_clients!client_id(profile_id)")
      .eq("id", input.projectId)
      .maybeSingle();
    const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;

    if (!project || (!isAdmin && client?.profile_id !== profile.id && project.assigned_admin_id !== profile.id)) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("files")
    .insert({
      project_id: input.projectId,
      lead_id: input.leadId,
      uploaded_by: profile.id,
      category: input.category,
      file_name: input.fileName,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      visibility: input.visibility,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, file: data }, { status: 201 });
}

import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { canAccessConversation } from "@/lib/auth/conversation-access";
import { resolveFileUrl } from "@/lib/files/resolve-url";
import { isProjectStoragePath } from "@/lib/messages/attachment-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: file, error: fileError } = await supabase
    .from("files")
    .select("id,project_id,file_name,storage_path,visibility,category")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    console.error("message_file_open_lookup_failed", { fileId, code: fileError.code, message: fileError.message });
    return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
  }

  if (!file?.project_id || !isProjectStoragePath(file.storage_path, file.project_id)) {
    return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,assigned_admin_id,bpd_clients!client_id(profile_id)")
    .eq("id", file.project_id)
    .maybeSingle();

  if (projectError) {
    console.error("message_file_open_project_failed", {
      fileId,
      projectId: file.project_id,
      code: projectError.code,
      message: projectError.message,
    });
    return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
  }

  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canAccess = canAccessConversation({
    role: profile.role,
    profileId: profile.id,
    clientProfileId: client?.profile_id,
    assignedAdminId: project?.assigned_admin_id,
  });
  const clientCanSee = profile.role !== "client" || ["client_visible", "client_upload"].includes(String(file.visibility ?? ""));

  if (!project || !canAccess || !clientCanSee) {
    return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
  }

  const url = await resolveFileUrl(supabase, file, 300);
  if (!url) {
    return NextResponse.json({ success: false, message: "File is unavailable." }, { status: 404 });
  }

  return NextResponse.redirect(url, 302);
}

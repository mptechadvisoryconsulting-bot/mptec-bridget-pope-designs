import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { hasSupabaseAdminEnv, safeErrorMessage } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const maxSize = 15 * 1024 * 1024;

function cleanFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const { profile } = await getCurrentProfile();
    if (!profile?.active) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ success: false, message: "Upload storage is not configured." }, { status: 503 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "").trim();
    const category = String(form.get("category") ?? "Project File").trim() || "Project File";
    const title = String(form.get("title") ?? (file instanceof File ? file.name : "Upload")).trim();
    const requestedVisibility = String(form.get("visibility") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "A file is required." }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ success: false, message: "A project is required." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ success: false, message: "Upload a JPG, PNG, WebP, HEIC/HEIF, or PDF file." }, { status: 400 });
    }
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: "File must be 15 MB or smaller." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const isAdmin = adminRoles.has(profile.role);
    const { data: project } = await supabase
      .from("projects")
      .select("id,assigned_admin_id,client_id,bpd_clients!client_id(profile_id)")
      .eq("id", projectId)
      .maybeSingle();
    const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;

    if (!project || (!isAdmin && client?.profile_id !== profile.id && project.assigned_admin_id !== profile.id)) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }

    const visibility = isAdmin
      ? requestedVisibility === "private_admin"
        ? "private_admin"
        : requestedVisibility === "client_upload"
          ? "client_upload"
          : "client_visible"
      : "client_upload";

    const extension = file.name.split(".").pop()?.toLowerCase() ?? file.type.split("/")[1] ?? "bin";
    const storagePath = `projects/${projectId}/${cleanFilePart(title) || "file"}-${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ success: false, message: "Unable to upload file." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("files")
      .insert({
        project_id: projectId,
        uploaded_by: profile.id,
        category,
        file_name: title || file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        visibility,
      })
      .select("id,file_name,category,visibility,storage_path,mime_type,created_at")
      .single();

    if (error) {
      console.error("project_file_record_failed", { projectId, code: error.code, message: error.message, storagePath });
      const { error: cleanupError } = await supabase.storage.from("project-files").remove([storagePath]);
      if (cleanupError) {
        console.error("project_file_cleanup_failed", { projectId, storagePath, message: cleanupError.message });
      }
      return NextResponse.json({ success: false, message: "Unable to save uploaded file." }, { status: 400 });
    }

    return NextResponse.json({ success: true, file: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: safeErrorMessage(error) }, { status: 400 });
  }
}

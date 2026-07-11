import { NextResponse } from "next/server";
import { fileSchema } from "@/lib/validation/file-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const input = fileSchema.parse(await request.json());
  const { data, error } = await createAdminClient()
    .from("files")
    .insert({
      project_id: input.projectId,
      lead_id: input.leadId,
      uploaded_by: input.uploadedBy ?? null,
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

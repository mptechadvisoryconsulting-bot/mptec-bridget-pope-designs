import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { proposalId } = await params;
  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id,proposal_number,status,project_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "PDF file is required." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ success: false, message: "Only PDF uploads are supported." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, message: "PDF must be 20MB or smaller." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${proposal.project_id}/${proposal.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const upload = await supabase.storage.from("proposal-uploads").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (upload.error) {
    return NextResponse.json({ success: false, message: upload.error.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const nextStatus = proposal.status === "draft" ? "sent" : proposal.status;
  const updatePayload: Record<string, unknown> = {
    uploaded_pdf_path: storagePath,
    uploaded_pdf_original_name: file.name,
    uploaded_pdf_uploaded_at: now,
    status: nextStatus,
    updated_at: now,
  };
  if (proposal.status === "draft" || nextStatus === "sent") {
    updatePayload.sent_at = now;
  }

  const { error: updateError } = await supabase.from("proposals").update(updatePayload).eq("id", proposal.id);
  if (updateError) {
    return NextResponse.json({ success: false, message: updateError.message }, { status: 400 });
  }

  await supabase.from("files").insert({
    project_id: proposal.project_id,
    category: "proposal_pdf",
    file_name: file.name,
    storage_path: storagePath,
    mime_type: "application/pdf",
    file_size: file.size,
    visibility: "client_visible",
    uploaded_by: admin.profile.id,
  });

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    project_id: proposal.project_id,
    action: "proposal_pdf_uploaded",
    entity_type: "proposal",
    entity_id: proposal.id,
    metadata: { storage_path: storagePath },
  });

  return NextResponse.json({
    success: true,
    path: storagePath,
    message: "Proposal PDF uploaded.",
  });
}

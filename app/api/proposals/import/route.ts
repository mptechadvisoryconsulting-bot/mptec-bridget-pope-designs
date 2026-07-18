import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ success: false, message: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim() || "Imported Proposal";
  const introduction = String(form.get("introduction") ?? "").trim() || null;
  const totalRaw = String(form.get("total") ?? "0").trim();
  const markSent = String(form.get("markSent") ?? "false") === "true";
  const total = Number(totalRaw);

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "PDF file is required." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ success: false, message: "Only PDF uploads are supported." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, message: "PDF must be 20MB or smaller." }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ success: false, message: "Project is required." }, { status: 400 });
  }
  if (!Number.isFinite(total) || total < 0) {
    return NextResponse.json({ success: false, message: "Total must be a valid amount." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) {
    return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const status = markSent ? "sent" : "draft";
  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      project_id: projectId,
      title,
      introduction,
      subtotal: total,
      total,
      status,
      sent_at: markSent ? now : null,
      created_by: admin.profile.id,
    })
    .select()
    .single();

  if (error || !proposal) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to create proposal." }, { status: 400 });
  }

  if (total > 0) {
    await supabase.from("proposal_items").insert({
      proposal_id: proposal.id,
      title,
      description: "Imported from PDF",
      quantity: 1,
      unit_price: total,
      total,
      sort_order: 0,
    });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${projectId}/${proposal.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const upload = await supabase.storage.from("proposal-uploads").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (upload.error) {
    await supabase.from("proposal_items").delete().eq("proposal_id", proposal.id);
    await supabase.from("proposals").delete().eq("id", proposal.id);
    return NextResponse.json({ success: false, message: upload.error.message }, { status: 400 });
  }

  await supabase
    .from("proposals")
    .update({
      uploaded_pdf_path: storagePath,
      uploaded_pdf_original_name: file.name,
      uploaded_pdf_uploaded_at: now,
      updated_at: now,
    })
    .eq("id", proposal.id);

  await supabase.from("files").insert({
    project_id: projectId,
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
    project_id: projectId,
    action: "proposal_imported",
    entity_type: "proposal",
    entity_id: proposal.id,
    metadata: { storage_path: storagePath, status },
  });

  return NextResponse.json(
    {
      success: true,
      proposal: { ...proposal, uploaded_pdf_path: storagePath },
      message: "Proposal imported from PDF.",
    },
    { status: 201 },
  );
}

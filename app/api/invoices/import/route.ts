import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

function invoiceNumber() {
  return `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ success: false, message: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const clientId = String(form.get("clientId") ?? "").trim();
  const projectId = String(form.get("projectId") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || "Imported invoice PDF";
  const totalRaw = String(form.get("total") ?? "0").trim();
  const dueDate = String(form.get("dueDate") ?? "").trim() || null;
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
  if (!clientId || !projectId) {
    return NextResponse.json({ success: false, message: "Client and project are required." }, { status: 400 });
  }
  if (!Number.isFinite(total) || total < 0) {
    return NextResponse.json({ success: false, message: "Total must be a valid amount." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id,client_id")
    .eq("id", projectId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ success: false, message: "Project does not belong to the selected client." }, { status: 400 });
  }

  const status = markSent ? "sent" : "draft";
  const now = new Date().toISOString();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      project_id: projectId,
      client_id: clientId,
      invoice_number: invoiceNumber(),
      invoice_type: "custom",
      description,
      subtotal: total,
      tax_amount: 0,
      discount_amount: 0,
      total,
      amount_paid: 0,
      balance_due: total,
      due_date: dueDate,
      status,
      sent_at: markSent ? now : null,
      active_version: 1,
    })
    .select()
    .single();

  if (error || !invoice) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to create invoice." }, { status: 400 });
  }

  if (total > 0) {
    await supabase.from("invoice_items").insert({
      invoice_id: invoice.id,
      title: description,
      description: "Imported from PDF",
      quantity: 1,
      unit_price: total,
      total,
    });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${projectId}/${invoice.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const upload = await supabase.storage.from("invoice-uploads").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (upload.error) {
    await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ success: false, message: upload.error.message }, { status: 400 });
  }

  await supabase
    .from("invoices")
    .update({
      uploaded_pdf_path: storagePath,
      uploaded_pdf_original_name: file.name,
      uploaded_pdf_uploaded_at: now,
      updated_at: now,
    })
    .eq("id", invoice.id);

  await supabase.from("files").insert({
    project_id: projectId,
    category: "invoice_pdf",
    file_name: file.name,
    storage_path: storagePath,
    mime_type: "application/pdf",
    file_size: file.size,
    visibility: "client_visible",
    uploaded_by: admin.profile.id,
  });

  await supabase.from("invoice_versions").insert({
    invoice_id: invoice.id,
    version_number: 1,
    invoice_snapshot: { invoice, items: [], totals: { subtotal: total, taxAmount: 0, discountAmount: 0, total }, imported: true },
    status: "active",
    created_by: admin.profile.id,
  });

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    project_id: projectId,
    action: "invoice_imported",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: { storage_path: storagePath, status },
  });

  return NextResponse.json(
    {
      success: true,
      invoice: { ...invoice, uploaded_pdf_path: storagePath },
      message: "Invoice imported from PDF.",
    },
    { status: 201 },
  );
}

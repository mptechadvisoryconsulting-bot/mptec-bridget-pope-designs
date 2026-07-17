import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { appUrl } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await params;
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,status,project_id,client_id,bpd_clients!client_id(profile_id,bpd_profiles(first_name,last_name,email)),bpd_projects!project_id(event_name)",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const notify = String(form?.get("notify") ?? "true") !== "false";

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
  const storagePath = `${invoice.project_id}/${invoice.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const upload = await supabase.storage.from("invoice-uploads").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (upload.error) {
    return NextResponse.json({ success: false, message: upload.error.message }, { status: 400 });
  }

  const nextStatus = invoice.status === "draft" ? "sent" : invoice.status;
  const updatePayload: Record<string, unknown> = {
    uploaded_pdf_path: storagePath,
    uploaded_pdf_original_name: file.name,
    uploaded_pdf_uploaded_at: new Date().toISOString(),
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (invoice.status === "draft" || nextStatus === "sent") {
    updatePayload.sent_at = new Date().toISOString();
  }
  const { error: updateError } = await supabase.from("invoices").update(updatePayload).eq("id", invoice.id);

  if (updateError) {
    return NextResponse.json({ success: false, message: updateError.message }, { status: 400 });
  }

  await supabase.from("files").insert({
    project_id: invoice.project_id,
    category: "invoice_pdf",
    file_name: file.name,
    storage_path: storagePath,
    mime_type: "application/pdf",
    file_size: file.size,
    visibility: "client_visible",
    uploaded_by: admin.profile.id,
  });

  const client = Array.isArray(invoice.bpd_clients) ? invoice.bpd_clients[0] : invoice.bpd_clients;
  const profile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;
  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";

  if (client?.profile_id) {
    await supabase.from("notifications").insert({
      recipient_id: client.profile_id,
      project_id: invoice.project_id,
      type: "invoice_pdf_uploaded",
      title: "Invoice PDF ready",
      message: `${invoice.invoice_number} has a PDF ready for review.`,
      action_url: `/client/invoices/${invoice.id}`,
    });
  }

  let emailStatus: "sent" | "not_configured" | "failed" | "skipped" = "skipped";
  if (notify && profile?.email) {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("id,business_email,invoice_reply_to,invoice_notifications_enabled")
      .limit(1)
      .maybeSingle();

    if (settings?.invoice_notifications_enabled !== false) {
      const result = await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: profile.email,
        replyTo: settings?.invoice_reply_to ?? settings?.business_email ?? undefined,
        subject: `Invoice ${invoice.invoice_number} from Bridget Pope Designs`,
        html: `
          <p>Hello ${clientName},</p>
          <p>Your invoice PDF for ${project?.event_name ?? "your event"} is ready.</p>
          <p><a href="${appUrl()}/client/invoices/${invoice.id}">View invoice</a></p>
        `,
        attachments: [{ filename: file.name, content: bytes.toString("base64") }],
      });
      emailStatus = result.status;

      await supabase.from("automation_logs").insert({
        automation_type: "invoice_uploaded_pdf_email",
        project_id: invoice.project_id,
        recipient: profile.email,
        status: result.status === "failed" ? "failed" : result.status,
        error_message: result.error ?? null,
        executed_at: new Date().toISOString(),
      });
    }
  }

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    project_id: invoice.project_id,
    action: "invoice_pdf_uploaded",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: { storage_path: storagePath, email_status: emailStatus },
  });

  return NextResponse.json({
    success: true,
    path: storagePath,
    emailStatus,
    message: "Invoice PDF uploaded.",
  });
}

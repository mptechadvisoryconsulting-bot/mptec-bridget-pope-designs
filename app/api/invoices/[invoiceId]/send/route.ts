import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { appUrl } from "@/lib/env";
import { sendTrackedEmail, toApiEmailStatus, type EmailDeliveryResult } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { currency } from "@/lib/currency";
import { buildInvoiceRenderModel } from "@/lib/invoices/render-model";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await params;
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,total,balance_due,status,client_id,project_id,active_version,subtotal,tax_amount,discount_amount,amount_paid,due_date,created_at,description,invoice_type,template_snapshot,bpd_invoice_items(*),bpd_clients(profile_id,bpd_profiles(first_name,last_name,email)),bpd_projects(event_name,venue_name)",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }

  const client = Array.isArray(invoice.bpd_clients) ? invoice.bpd_clients[0] : invoice.bpd_clients;
  const profile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;
  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const clientEmail = profile?.email;
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";
  const invoiceUrl = `${appUrl()}/client/invoices/${invoice.id}`;
  const versionNumber = Number(invoice.active_version ?? 1) || 1;
  const isUpdatedInvoice = versionNumber > 1;

  const { data: settings } = await supabase
    .from("business_settings")
    .select("id,business_email,invoice_reply_to,invoice_notifications_enabled")
    .limit(1)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: invoice.status === "paid" ? "paid" : "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  if (updateError) {
    return NextResponse.json({ success: false, message: updateError.message }, { status: 400 });
  }

  if (client?.profile_id) {
    await supabase.from("notifications").insert({
      recipient_id: client.profile_id,
      project_id: invoice.project_id,
      type: "invoice_sent",
      title: isUpdatedInvoice ? "Invoice updated" : "Invoice ready",
      message: isUpdatedInvoice
        ? `${invoice.invoice_number} was updated (v${versionNumber}) and is ready for review.`
        : `${invoice.invoice_number} is ready for review.`,
      action_url: `/client/invoices/${invoice.id}`,
    });
  }

  const model = buildInvoiceRenderModel({
    invoice,
    items: invoice.bpd_invoice_items ?? [],
    clientName,
    clientEmail,
    projectName: project?.event_name,
    venue: project?.venue_name,
    versionNumber,
  });
  const pdf = await generateInvoicePdf(model);

  const subject = isUpdatedInvoice
    ? `Updated invoice ${invoice.invoice_number} from Bridget Pope Designs`
    : `Invoice ${invoice.invoice_number} from Bridget Pope Designs`;

  let emailStatus: EmailDeliveryResult["status"] = "not_configured";
  if (clientEmail && settings?.invoice_notifications_enabled !== false) {
    const result = await sendTrackedEmail({
      supabase,
      settingsId: settings?.id,
      from: emailFrom(),
      to: clientEmail,
      replyTo: settings?.invoice_reply_to ?? settings?.business_email ?? undefined,
      subject,
      html: `
        <p>Hello ${clientName},</p>
        <p>${
          isUpdatedInvoice
            ? `Your invoice for ${project?.event_name ?? "your event"} has been updated to version ${versionNumber}. Please review the attached PDF for the latest details.`
            : `Your invoice is ready.`
        }</p>
        <p><strong>Balance due:</strong> ${currency(Number(invoice.balance_due ?? invoice.total ?? 0))}</p>
        <p><a href="${invoiceUrl}">Review invoice</a></p>
        <p>Payment arrangements are handled directly with Bridget Pope Designs. Your portal balance updates when a payment is recorded.</p>
      `,
      attachments: [{ filename: `Invoice-${invoice.invoice_number}.pdf`, content: pdf.toString("base64") }],
    });
    emailStatus = result.status;

    await supabase.from("automation_logs").insert({
      automation_type: "invoice_sent_email",
      project_id: invoice.project_id,
      recipient: clientEmail,
      status: result.status,
      error_message: result.error ?? null,
      executed_at: new Date().toISOString(),
    });
  }

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    project_id: invoice.project_id,
    action: isUpdatedInvoice ? "invoice_resent_updated" : "invoice_sent",
    entity_type: "invoice",
    entity_id: invoice.id,
    // Internal log storage keeps the lowercase delivery status; only the API response uses the uppercase contract.
    metadata: { invoice_number: invoice.invoice_number, email_status: emailStatus, version: versionNumber },
  });

  return NextResponse.json({ success: true, invoiceUrl, emailStatus: toApiEmailStatus(emailStatus) });
}

import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { appUrl } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await params;
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,invoice_number,total,balance_due,status,client_id,project_id,bpd_clients(profile_id,bpd_profiles(first_name,last_name,email)),bpd_projects(event_name)")
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
      stripe_payment_link_url: null,
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
      title: "Invoice ready",
      message: `${invoice.invoice_number} is ready for review and payment.`,
      action_url: `/client/invoices/${invoice.id}`,
    });
  }

  let emailStatus = "not_configured";
  if (clientEmail && settings?.invoice_notifications_enabled !== false) {
    const result = await sendTrackedEmail({
      supabase,
      settingsId: settings?.id,
      from: emailFrom(),
      to: clientEmail,
      replyTo: settings?.invoice_reply_to ?? settings?.business_email ?? undefined,
      subject: `Invoice ${invoice.invoice_number} from Bridget Pope Designs`,
      html: `
        <p>Hello ${clientName},</p>
        <p>Your invoice for ${project?.event_name ?? "your event"} is ready.</p>
        <p><strong>Balance due:</strong> ${currency(Number(invoice.balance_due ?? invoice.total ?? 0))}</p>
        <p><a href="${invoiceUrl}">Review and pay invoice</a></p>
      `,
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
    action: "invoice_sent",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: { invoice_number: invoice.invoice_number, email_status: emailStatus },
  });

  return NextResponse.json({ success: true, invoiceUrl, emailStatus });
}

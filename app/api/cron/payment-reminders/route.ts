import { NextResponse } from "next/server";
import { appUrl, requireEnv } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

const OPEN_STATUSES = ["sent", "viewed", "pending", "partially_paid", "overdue", "processing"];

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const inThreeDays = new Date(today);
  inThreeDays.setDate(today.getDate() + 3);
  const todayIso = today.toISOString().slice(0, 10);
  const soonIso = inThreeDays.toISOString().slice(0, 10);

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,due_date,balance_due,status,project_id,client_id,bpd_clients!client_id(profile_id,bpd_profiles(email,first_name)),bpd_projects!project_id(event_name)")
    .in("status", OPEN_STATUSES)
    .gt("balance_due", 0)
    .not("due_date", "is", null)
    .lte("due_date", soonIso);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const { data: settings } = await supabase.from("business_settings").select("id,business_email,inquiry_recipient_email").limit(1).maybeSingle();
  let reminded = 0;

  for (const invoice of invoices ?? []) {
    const client = Array.isArray(invoice.bpd_clients) ? invoice.bpd_clients[0] : invoice.bpd_clients;
    const profile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;
    const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
    const recipientId = client?.profile_id;
    const email = profile?.email;
    if (!recipientId) continue;

    const dueDate = String(invoice.due_date);
    const overdue = dueDate < todayIso;
    const title = overdue ? "Invoice payment overdue" : "Invoice payment reminder";
    const message = overdue
      ? `${invoice.invoice_number} for ${project?.event_name ?? "your event"} is overdue. Balance due: $${Number(invoice.balance_due).toFixed(2)}.`
      : `${invoice.invoice_number} is due on ${dueDate}. Balance due: $${Number(invoice.balance_due).toFixed(2)}.`;

    await supabase.from("notifications").insert({
      recipient_id: recipientId,
      project_id: invoice.project_id,
      type: "payment_reminder",
      title,
      message,
      action_url: `/client/invoices/${invoice.id}`,
    });

    if (email) {
      await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: email,
        subject: `${title}: ${invoice.invoice_number}`,
        html: `
          <p>Hi ${profile?.first_name ?? "there"},</p>
          <p>${message}</p>
          <p><a href="${appUrl()}/client/invoices/${invoice.id}">View invoice</a></p>
        `,
      });
    }

    await supabase.from("automation_logs").insert({
      automation_type: "payment_reminders",
      project_id: invoice.project_id,
      recipient: email ?? recipientId,
      status: "success",
      executed_at: new Date().toISOString(),
    });

    reminded += 1;
  }

  return NextResponse.json({ success: true, reminded });
}

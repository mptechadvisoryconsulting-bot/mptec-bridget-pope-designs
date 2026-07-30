import { NextResponse } from "next/server";
import { appUrl, requireEnv } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

const OPEN_STATUSES = ["sent", "viewed", "pending", "partially_paid", "overdue", "processing"];
const DEDUPE_DAYS = 3;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("id,business_email,inquiry_recipient_email,payment_reminders_enabled,invoice_notifications_enabled")
    .limit(1)
    .maybeSingle();

  if (!settings?.payment_reminders_enabled) {
    return NextResponse.json({
      success: true,
      reminded: 0,
      skipped: "payment_reminders_disabled",
    });
  }

  const today = new Date();
  const inThreeDays = new Date(today);
  inThreeDays.setDate(today.getDate() + 3);
  const todayIso = today.toISOString().slice(0, 10);
  const soonIso = inThreeDays.toISOString().slice(0, 10);
  const dedupeSince = new Date(today);
  dedupeSince.setDate(today.getDate() - DEDUPE_DAYS);

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,due_date,balance_due,status,project_id,client_id,bpd_clients!client_id(profile_id,bpd_profiles(email,first_name)),bpd_projects!project_id(event_name)",
    )
    .in("status", OPEN_STATUSES)
    .gt("balance_due", 0)
    .not("due_date", "is", null)
    .lte("due_date", soonIso);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const { data: recentLogs } = await supabase
    .from("automation_logs")
    .select("recipient,executed_at")
    .eq("automation_type", "payment_reminders")
    .gte("executed_at", dedupeSince.toISOString())
    .eq("status", "success");

  // Recipient is stored as `invoice:{id}|email-or-profile` for dedupe.
  const recentlyReminded = new Set(
    (recentLogs ?? [])
      .map((row) => {
        const value = String(row.recipient ?? "");
        const match = /^invoice:([^|]+)/.exec(value);
        return match?.[1] ?? "";
      })
      .filter(Boolean),
  );

  let reminded = 0;
  let skippedDedupe = 0;

  for (const invoice of invoices ?? []) {
    if (recentlyReminded.has(invoice.id)) {
      skippedDedupe += 1;
      continue;
    }

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

    if (email && settings.invoice_notifications_enabled !== false) {
      await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: email,
        subject: `${title}: ${invoice.invoice_number}`,
        html: `
          <p>Hi ${profile?.first_name ?? "there"},</p>
          <p>${message}</p>
          <p>Payment arrangements are handled offline with Bridget Pope Designs.</p>
          <p><a href="${appUrl()}/client/invoices/${invoice.id}">View invoice</a></p>
        `,
      });
    }

    await supabase.from("automation_logs").insert({
      automation_type: "payment_reminders",
      project_id: invoice.project_id,
      recipient: `invoice:${invoice.id}|${email ?? recipientId}`,
      status: "success",
      executed_at: new Date().toISOString(),
    });

    reminded += 1;
  }

  return NextResponse.json({ success: true, reminded, skippedDedupe });
}

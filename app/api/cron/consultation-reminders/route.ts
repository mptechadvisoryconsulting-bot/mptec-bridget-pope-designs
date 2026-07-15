import { NextResponse } from "next/server";
import { appUrl, requireEnv } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: consultations, error } = await supabase
    .from("consultations")
    .select("id,scheduled_at,meeting_type,meeting_link,location,status,lead_id,project_id,bpd_leads(first_name,last_name,email),bpd_projects(event_name,assigned_admin_id,bpd_clients(profile_id))")
    .eq("status", "scheduled")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", inOneDay.toISOString());

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const { data: settings } = await supabase.from("business_settings").select("id").limit(1).maybeSingle();
  let reminded = 0;

  for (const consultation of consultations ?? []) {
    const lead = Array.isArray(consultation.bpd_leads) ? consultation.bpd_leads[0] : consultation.bpd_leads;
    const project = Array.isArray(consultation.bpd_projects) ? consultation.bpd_projects[0] : consultation.bpd_projects;
    const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
    const when = consultation.scheduled_at ? new Date(consultation.scheduled_at).toLocaleString() : "soon";
    const title = "Consultation reminder";
    const message = `Your consultation${project?.event_name ? ` for ${project.event_name}` : ""} is scheduled for ${when}.`;

    const recipients = [project?.assigned_admin_id, client?.profile_id].filter(Boolean) as string[];
    if (recipients.length) {
      await supabase.from("notifications").insert(
        recipients.map((recipientId) => ({
          recipient_id: recipientId,
          project_id: consultation.project_id,
          lead_id: consultation.lead_id,
          type: "consultation_reminder",
          title,
          message,
          action_url: consultation.project_id ? `/admin/projects/${consultation.project_id}` : "/admin/consultations",
        })),
      );
    }

    if (lead?.email) {
      await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: lead.email,
        subject: title,
        html: `
          <p>Hi ${lead.first_name ?? "there"},</p>
          <p>${message}</p>
          <p>Meeting type: ${consultation.meeting_type ?? "TBD"}</p>
          ${consultation.meeting_link ? `<p>Join: <a href="${consultation.meeting_link}">${consultation.meeting_link}</a></p>` : ""}
          ${consultation.location ? `<p>Location: ${consultation.location}</p>` : ""}
          <p><a href="${appUrl()}/admin/consultations">Open consultations</a></p>
        `,
      });
    }

    await supabase.from("automation_logs").insert({
      automation_type: "consultation_reminders",
      project_id: consultation.project_id,
      recipient: lead?.email ?? recipients.join(","),
      status: "success",
      executed_at: new Date().toISOString(),
    });

    reminded += 1;
  }

  return NextResponse.json({ success: true, reminded });
}

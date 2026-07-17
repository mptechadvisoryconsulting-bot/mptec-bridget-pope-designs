import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { daysUntilEvent } from "@/lib/dates/timezone";
import { createAdminClient } from "@/lib/supabase/admin";

const REMINDER_DAYS = [20, 15, 10, 5, 1, 0];
const ACTIVE_STATUSES = ["booked", "planning", "design_in_progress", "finalizing", "ready_for_event"];

type CountdownProject = {
  id: string;
  event_name: string;
  event_date: string;
  venue_name?: string | null;
  assigned_admin_id?: string | null;
  bpd_clients?: { profile_id?: string | null } | Array<{ profile_id?: string | null }> | null;
};

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,event_name,event_date,venue_name,assigned_admin_id,bpd_clients!client_id(profile_id)")
    .in("status", ACTIVE_STATUSES)
    .not("event_date", "is", null);

  if (error) throw new Error(error.message);

  let created = 0;

  for (const project of (projects ?? []) as CountdownProject[]) {
    const remaining = daysUntilEvent(project.event_date);
    if (!REMINDER_DAYS.includes(remaining)) continue;

    const { data: existing } = await supabase
      .from("event_reminders")
      .select("id")
      .eq("project_id", project.id)
      .eq("days_before_event", remaining)
      .maybeSingle();

    if (existing) continue;

    const clientProfileId = Array.isArray(project.bpd_clients)
      ? project.bpd_clients[0]?.profile_id
      : project.bpd_clients?.profile_id;
    const recipients = [project.assigned_admin_id, clientProfileId].filter(Boolean);

    if (recipients.length) {
      await supabase.from("notifications").insert(
        recipients.map((recipientId) => ({
          recipient_id: recipientId,
          project_id: project.id,
          type: "event_countdown",
          title: remaining === 0 ? "Event day is here" : `${remaining} days until your event`,
          message: `${project.event_name} at ${project.venue_name ?? "the venue"} is coming up.`,
          action_url: recipientId === project.assigned_admin_id ? `/admin/projects/${project.id}` : "/client/dashboard",
        })),
      );
    }

    await supabase.from("event_reminders").insert({
      project_id: project.id,
      days_before_event: remaining,
      admin_notification_sent_at: new Date().toISOString(),
      client_notification_sent_at: new Date().toISOString(),
    });

    await supabase.from("automation_logs").insert({
      automation_type: "event_countdown",
      project_id: project.id,
      recipient: recipients.join(","),
      status: "success",
      executed_at: new Date().toISOString(),
    });

    created += 1;
  }

  return NextResponse.json({ success: true, created });
}

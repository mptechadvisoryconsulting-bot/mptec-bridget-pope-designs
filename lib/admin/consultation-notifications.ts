import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";

const CENTRAL_TIME_ZONE = "America/Chicago";

type AnyClient = SupabaseClient<any>;

export async function sendConsultationScheduledEmail(
  supabase: AnyClient,
  consultationId: string,
): Promise<{ sent: boolean; warning?: string }> {
  const { data: consultation, error } = await supabase
    .from("consultations")
    .select("id,scheduled_at,meeting_type,meeting_link,location,lead_id,bpd_leads!lead_id(first_name,email)")
    .eq("id", consultationId)
    .maybeSingle();

  if (error || !consultation?.scheduled_at) {
    return { sent: false, warning: error?.message ?? "Scheduled consultation could not be loaded." };
  }

  const lead = Array.isArray(consultation.bpd_leads) ? consultation.bpd_leads[0] : consultation.bpd_leads;
  if (!lead?.email) return { sent: false, warning: "No prospect email is available for this consultation." };

  const { data: settings } = await supabase
    .from("business_settings")
    .select("id,business_email,client_email_notifications_enabled")
    .limit(1)
    .maybeSingle();

  if (settings?.client_email_notifications_enabled === false) {
    return { sent: false, warning: "Client email notifications are disabled." };
  }

  const when = formatInTimeZone(new Date(consultation.scheduled_at), CENTRAL_TIME_ZONE, "EEEE, MMMM d, yyyy 'at' h:mm a zzz");
  const method = String(consultation.meeting_type ?? "consultation").replace(/_/g, " ");
  const locationLine = consultation.meeting_link
    ? `<p><strong>Meeting link:</strong> <a href="${consultation.meeting_link}">${consultation.meeting_link}</a></p>`
    : consultation.location
      ? `<p><strong>Location:</strong> ${consultation.location}</p>`
      : "";

  const result = await sendTrackedEmail({
    supabase,
    settingsId: settings?.id,
    from: emailFrom(),
    to: lead.email,
    replyTo: settings?.business_email ?? undefined,
    subject: "Your Bridget Pope Designs consultation is scheduled",
    html: `
      <p>Hello ${lead.first_name ?? "there"},</p>
      <p>Your consultation with Bridget Pope Designs is scheduled.</p>
      <p><strong>When:</strong> ${when}</p>
      <p><strong>Consultation type:</strong> ${method}</p>
      ${locationLine}
      <p>If you need to make a change, reply to this email and the team will help you reschedule.</p>
    `,
  });

  if (result.status === "failed") {
    return { sent: false, warning: result.error ?? "Consultation was scheduled, but the confirmation email failed." };
  }

  return { sent: true };
}

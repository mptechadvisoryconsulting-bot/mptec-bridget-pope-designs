import { appUrl } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";

type SupabaseAdmin = {
  from(table: string): any;
};

export async function notifyProposalResponseOwners(input: {
  supabase: SupabaseAdmin;
  projectId: string;
  proposalId: string;
  assignedAdminId?: string | null;
  eventName?: string | null;
  proposalLabel?: string | null;
  response: "approved" | "changes_requested" | "rejected";
}) {
  const { supabase, projectId, proposalId, assignedAdminId, eventName, proposalLabel, response } = input;
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["owner", "admin"])
    .eq("active", true);

  const recipients = new Set<string>();
  for (const admin of admins ?? []) {
    if (admin.id) recipients.add(admin.id);
  }
  if (assignedAdminId) recipients.add(assignedAdminId);

  const title =
    response === "approved"
      ? "Proposal approved"
      : response === "changes_requested"
        ? "Proposal changes requested"
        : "Proposal declined";
  const subjectName = proposalLabel || eventName || "Proposal";
  const message =
    response === "approved"
      ? `${subjectName} was approved by the client.`
      : response === "changes_requested"
        ? `${subjectName} has a client change request ready for review.`
        : `${subjectName} was declined by the client.`;

  if (recipients.size) {
    const { error } = await supabase.from("notifications").insert(
      [...recipients].map((recipient_id) => ({
        recipient_id,
        project_id: projectId,
        type: `proposal_${response}`,
        title,
        message,
        action_url: `/admin/proposals/${proposalId}`,
      })),
    );
    if (error) {
      console.error("proposal_response_notification_failed", { proposalId, code: error.code, message: error.message });
    }
  }

  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("id,owner_message_notification_email,business_email")
      .limit(1)
      .maybeSingle();
    const ownerEmail = settings?.owner_message_notification_email ?? settings?.business_email;
    if (!ownerEmail) return;

    await sendTrackedEmail({
      supabase,
      settingsId: settings?.id,
      from: emailFrom(),
      to: ownerEmail,
      subject: `${title}: ${subjectName}`,
      html: `<p>${message}</p><p><a href="${appUrl()}/admin/proposals/${proposalId}">Review the proposal response</a></p>`,
    });
  } catch (error) {
    console.error("proposal_response_email_failed", error instanceof Error ? error.message : error);
  }
}

import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("id,business_email,inquiry_recipient_email")
    .limit(1)
    .maybeSingle();
  const recipient = settings?.inquiry_recipient_email ?? settings?.business_email ?? process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL;

  if (!recipient) {
    return NextResponse.json({ success: false, message: "Set an inquiry recipient email first." }, { status: 400 });
  }

  const result = await sendTrackedEmail({
    supabase,
    settingsId: settings?.id,
    from: emailFrom(),
    to: recipient,
    subject: "Bridget Pope Designs email test",
    html: `
      <p>This confirms the Bridget Pope Designs owner email settings are ready.</p>
      <p>Consultation inquiries will send important lead details to this inbox.</p>
      <p><a href="${appUrl()}/admin">Open admin dashboard</a></p>
    `,
  });

  if (result.status === "sent") {
    if (settings?.id) {
      await supabase
        .from("business_settings")
        .update({ email_last_test_sent_at: new Date().toISOString(), email_last_error: null })
        .eq("id", settings.id);
    }

    await supabase.from("activity_logs").insert({
      actor_id: owner.profile.id,
      action: "business_email_test_sent",
      entity_type: "business_settings",
      entity_id: settings?.id ?? null,
      metadata: { recipient },
    });

    return NextResponse.json({ success: true });
  }

  const message = result.error ?? "Unable to send test email.";

  if (settings?.id) {
    await supabase.from("business_settings").update({ email_last_error: message }).eq("id", settings.id);
  }

  return NextResponse.json({ success: false, message }, { status: result.status === "not_configured" ? 409 : 400 });
}

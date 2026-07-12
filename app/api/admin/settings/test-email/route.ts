import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { emailFrom, resend } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("id,business_email")
    .limit(1)
    .maybeSingle();
  const recipient = settings?.business_email ?? process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL;

  if (!recipient) {
    return NextResponse.json({ success: false, message: "Set an inquiry recipient email first." }, { status: 400 });
  }

  try {
    await resend.emails.send({
      from: emailFrom(),
      to: recipient,
      subject: "Bridget Pope Designs email test",
      html: `
        <p>This confirms the Bridget Pope Designs owner email settings are ready.</p>
        <p>Consultation inquiries will send important lead details to this inbox.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin">Open admin dashboard</a></p>
      `,
    });

    if (settings?.id) {
      await supabase
        .from("business_settings")
        .update({ email_last_test_sent_at: new Date().toISOString(), email_last_error: null })
        .eq("id", settings.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send test email.";

    if (settings?.id) {
      await supabase.from("business_settings").update({ email_last_error: message }).eq("id", settings.id);
    }

    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

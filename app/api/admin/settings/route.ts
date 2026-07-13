import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  businessEmail: z.string().email(),
});

export async function PUT(request: Request) {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  const input = settingsSchema.parse(await request.json());
  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("business_settings").select("id").limit(1).maybeSingle();
  const payload = {
    business_name: "Bridget Pope Designs",
    business_display_name: "Bridget Pope Designs",
    business_phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "(629) 295-4210",
    business_email: input.businessEmail,
    inquiry_recipient_email: input.businessEmail,
    invoice_reply_to: input.businessEmail,
    owner_message_notification_email: input.businessEmail,
    inquiry_notifications_enabled: true,
    invoice_notifications_enabled: true,
    payment_confirmation_notifications_enabled: true,
    client_email_notifications_enabled: true,
    email_readiness_status: "ready",
    timezone: "America/Chicago",
    stripe_payment_model: "destination_charges",
  };

  const { error } = existing?.id
    ? await supabase.from("business_settings").update(payload).eq("id", existing.id)
    : await supabase.from("business_settings").insert(payload);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  await supabase.from("activity_logs").insert({
    actor_id: owner.profile.id,
    action: "business_email_settings_updated",
    entity_type: "business_settings",
    entity_id: existing?.id ?? null,
    metadata: { business_email: input.businessEmail },
  });

  return NextResponse.json({ success: true });
}

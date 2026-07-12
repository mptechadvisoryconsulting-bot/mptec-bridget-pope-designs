import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  businessEmail: z.string().email(),
});

export async function PUT(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = settingsSchema.parse(await request.json());
  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("business_settings").select("id").limit(1).maybeSingle();
  const payload = {
    business_name: "Bridget Pope Designs",
    business_phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "(629) 295-4210",
    business_email: input.businessEmail,
    timezone: "America/Chicago",
    stripe_payment_model: "destination_charges",
  };

  const { error } = existing?.id
    ? await supabase.from("business_settings").update(payload).eq("id", existing.id)
    : await supabase.from("business_settings").insert(payload);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

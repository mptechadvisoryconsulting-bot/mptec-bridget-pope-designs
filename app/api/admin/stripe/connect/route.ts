import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectOnboardingLink, ensureStripeConnectAccount } from "@/lib/stripe/connect";

export async function POST() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const supabase = createAdminClient();
  const settings = await ensureStripeConnectAccount(supabase);

  if (!settings.stripe_connected_account_id) {
    return NextResponse.json({ success: false, message: "Stripe account was not created." }, { status: 400 });
  }

  const link = await createStripeConnectOnboardingLink(settings.stripe_connected_account_id);
  return NextResponse.json({ success: true, url: link.url, settings });
}

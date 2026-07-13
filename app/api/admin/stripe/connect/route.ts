import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectOnboardingLink, ensureStripeConnectAccount } from "@/lib/stripe/connect";

export async function POST() {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("business_settings")
    .select("id,stripe_connected_account_id")
    .limit(1)
    .maybeSingle();
  const settings = await ensureStripeConnectAccount(supabase);

  if (!settings.stripe_connected_account_id) {
    return NextResponse.json({ success: false, message: "Stripe account was not created." }, { status: 400 });
  }

  const link = await createStripeConnectOnboardingLink(settings.stripe_connected_account_id);
  await supabase.from("activity_logs").insert({
    actor_id: owner.profile.id,
    action: before?.stripe_connected_account_id ? "stripe_onboarding_link_created" : "stripe_connected_account_created",
    entity_type: "business_settings",
    entity_id: settings.id,
    metadata: {
      payment_model: settings.stripe_payment_model,
      stripe_account_last4: settings.stripe_connected_account_id.slice(-4),
    },
  });

  return NextResponse.json({
    success: true,
    url: link.url,
    settings: {
      ...settings,
      stripe_connected_account_id: `acct_...${settings.stripe_connected_account_id.slice(-4)}`,
    },
  });
}

import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectOnboardingLink, ensureStripeConnectAccount, stripeReadinessStatus } from "@/lib/stripe/connect";
import { stripeConnectErrorResponse } from "@/lib/stripe/connect-errors";

export async function POST() {
  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const supabase = createAdminClient();
    const settings = await ensureStripeConnectAccount(supabase);

    if (!settings.stripe_connected_account_id) {
      return NextResponse.json(
        { success: false, code: "STRIPE_CONNECTED_ACCOUNT_ERROR", message: "Stripe account was not created." },
        { status: 409 },
      );
    }

    if (stripeReadinessStatus(settings) === "ready") {
      return NextResponse.json(
        { success: false, code: "ACCOUNT_READY_USE_MANAGE", message: "Payments are ready. Use Manage Payment Account." },
        { status: 409 },
      );
    }

    const link = await createStripeConnectOnboardingLink(settings.stripe_connected_account_id);
    const { error: provisioningUpdateError } = await supabase
      .from("business_settings")
      .update({
        stripe_connect_provisioning_status: "onboarding_required",
        stripe_connect_provisioning_error: null,
      })
      .eq("id", settings.id);

    if (provisioningUpdateError) throw new Error(provisioningUpdateError.message);

    const { error: activityError } = await supabase.from("activity_logs").insert({
      actor_id: owner.profile.id,
      action: "stripe_onboarding_link_created",
      entity_type: "business_settings",
      entity_id: settings.id,
      metadata: {
        payment_model: settings.stripe_payment_model,
        stripe_account_last4: settings.stripe_connected_account_id.slice(-4),
      },
    });

    if (activityError) {
      console.error("Stripe onboarding activity log failed", { operation: "stripe_onboarding_activity_log", code: activityError.code });
    }

    return NextResponse.json({
      success: true,
      url: link.url,
      settings: {
        ...settings,
        stripe_connected_account_id: `acct_...${settings.stripe_connected_account_id.slice(-4)}`,
      },
    });
  } catch (error) {
    return stripeConnectErrorResponse(error, "stripe_account_link_create");
  }
}

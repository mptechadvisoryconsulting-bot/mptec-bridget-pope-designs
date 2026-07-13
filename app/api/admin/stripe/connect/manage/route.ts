import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectManagementLink, getStripeReadiness } from "@/lib/stripe/connect";
import { stripeConnectErrorResponse } from "@/lib/stripe/connect-errors";

export async function POST() {
  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const supabase = createAdminClient();
    const readiness = await getStripeReadiness(supabase);
    const accountId = readiness.settings.stripe_connected_account_id;

    if (!accountId) {
      return NextResponse.json(
        { success: false, code: "STRIPE_ACCOUNT_NOT_CONNECTED", message: "Stripe payment setup has not been connected yet." },
        { status: 409 },
      );
    }

    if (!readiness.ready) {
      return NextResponse.json(
        { success: false, code: "STRIPE_ONBOARDING_REQUIRED", message: "Stripe onboarding must be completed before account management is available." },
        { status: 409 },
      );
    }

    const link = await createStripeConnectManagementLink(accountId);
    const { error: activityError } = await supabase.from("activity_logs").insert({
      actor_id: owner.profile.id,
      action: "stripe_management_link_created",
      entity_type: "business_settings",
      entity_id: readiness.settings.id,
      metadata: {
        payment_model: readiness.settings.stripe_payment_model,
        stripe_account_last4: accountId.slice(-4),
      },
    });

    if (activityError) {
      console.error("Stripe management activity log failed", { operation: "stripe_management_activity_log", code: activityError.code });
    }

    return NextResponse.json({
      success: true,
      url: link.url,
      message: "Opening Stripe account management.",
    });
  } catch (error) {
    return stripeConnectErrorResponse(error, "stripe_login_link_create");
  }
}

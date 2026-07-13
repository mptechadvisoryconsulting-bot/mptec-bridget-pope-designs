import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectManagementLink, getStripeReadiness } from "@/lib/stripe/connect";
import { logSafeStripeConnectError, runStage, stripeConnectErrorResponse, toConnectStageError } from "@/lib/stripe/connect-errors";

export async function POST() {
  const correlationId = randomUUID();

  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const supabase = createAdminClient();
    const readiness = await getStripeReadiness(supabase, correlationId);
    const accountId = readiness.settings.stripe_connected_account_id;

    if (!accountId) {
      return NextResponse.json(
        { success: false, code: "STRIPE_ACCOUNT_NOT_CONNECTED", message: "Stripe payment setup has not been connected yet.", correlationId },
        { status: 409 },
      );
    }

    if (!readiness.ready) {
      return NextResponse.json(
        {
          success: false,
          code: "STRIPE_ONBOARDING_REQUIRED",
          message: "Stripe onboarding must be completed before account management is available.",
          correlationId,
        },
        { status: 409 },
      );
    }

    const link = await runStage("connect_login_link_create", correlationId, () => createStripeConnectManagementLink(accountId));

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
      logSafeStripeConnectError(toConnectStageError("connect_activity_log", activityError, correlationId));
    }

    return NextResponse.json({
      success: true,
      url: link.url,
      correlationId,
      message: "Opening Stripe account management.",
    });
  } catch (error) {
    return stripeConnectErrorResponse(error, "connect_login_link_create", correlationId);
  }
}

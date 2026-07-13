import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectOnboardingLink, ensureStripeConnectAccount, stripeReadinessStatus } from "@/lib/stripe/connect";
import { logSafeStripeConnectError, runStage, stripeConnectErrorResponse, toConnectStageError } from "@/lib/stripe/connect-errors";

export async function POST() {
  const correlationId = randomUUID();

  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const supabase = createAdminClient();
    const settings = await ensureStripeConnectAccount(supabase, correlationId);

    if (!settings.stripe_connected_account_id) {
      return NextResponse.json(
        {
          success: false,
          code: "STRIPE_CONNECTED_ACCOUNT_ERROR",
          message: "Stripe account was not created.",
          stage: "connect_account_persist",
          correlationId,
        },
        { status: 409 },
      );
    }

    if (stripeReadinessStatus(settings) === "ready") {
      return NextResponse.json(
        { success: false, code: "ACCOUNT_READY_USE_MANAGE", message: "Payments are ready. Use Manage Payment Account.", correlationId },
        { status: 409 },
      );
    }

    const link = await runStage("connect_account_link_create", correlationId, () =>
      createStripeConnectOnboardingLink(settings.stripe_connected_account_id as string),
    );

    const updatedSettings = await runStage("connect_provisioning_status_update", correlationId, async () => {
      const { data, error } = await supabase
        .from("business_settings")
        .update({
          stripe_connect_provisioning_status: "onboarding_required",
          stripe_connect_provisioning_error: null,
        })
        .eq("id", settings.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data ?? settings;
    });

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
      logSafeStripeConnectError(toConnectStageError("connect_activity_log", activityError, correlationId));
    }

    return NextResponse.json({
      success: true,
      url: link.url,
      correlationId,
      settings: {
        ...updatedSettings,
        stripe_connected_account_id: `acct_...${settings.stripe_connected_account_id.slice(-4)}`,
      },
    });
  } catch (error) {
    return stripeConnectErrorResponse(error, "connect_account_link_create", correlationId);
  }
}

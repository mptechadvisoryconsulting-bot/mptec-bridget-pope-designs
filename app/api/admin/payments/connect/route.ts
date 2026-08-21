import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createConnectedAccountOnboardingLink,
  createConnectedMerchantAccount,
  mapConnectedAccountSnapshot,
  retrieveConnectedMerchantAccount,
  stripeServerConfigured,
} from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to configure Stripe Connect.";
}

async function syncSettings(supabase: ReturnType<typeof createAdminClient>, settingsId: string, account: any) {
  const snapshot = mapConnectedAccountSnapshot(account);
  const readiness = snapshot.ready ? "ready" : "action_required";
  const provisioningStatus = snapshot.ready ? "ready" : "onboarding_required";
  const disabledReason = snapshot.cardPaymentsStatus === "active" ? null : "card_payments_not_active";

  await supabase
    .from("business_settings")
    .update({
      stripe_connected_account_id: snapshot.id,
      stripe_payment_model: "direct_charge_v2",
      stripe_charges_enabled: snapshot.cardPaymentsStatus === "active",
      stripe_payouts_enabled: snapshot.payoutsStatus === "active",
      stripe_details_submitted: snapshot.requirementsCurrentlyDue.length === 0,
      stripe_requirements_currently_due: snapshot.requirementsCurrentlyDue,
      stripe_requirements_disabled_reason: disabledReason,
      stripe_account_last_synced_at: new Date().toISOString(),
      stripe_connect_provisioning_status: provisioningStatus,
      stripe_connect_provisioning_error: null,
      stripe_connect_provisioned_at: snapshot.ready ? new Date().toISOString() : null,
      payment_readiness_status: readiness,
    })
    .eq("id", settingsId);

  return snapshot;
}

export async function POST() {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  if (!stripeServerConfigured()) {
    return NextResponse.json(
      { success: false, message: "Stripe server credentials are not configured on this deployment." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const { data: settings, error: settingsError } = await supabase
    .from("business_settings")
    .select(
      "id,business_name,business_display_name,business_email,inquiry_recipient_email,stripe_connected_account_id,stripe_payment_model,stripe_connect_provisioning_key",
    )
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings?.id) {
    return NextResponse.json({ success: false, message: "Business payment settings are unavailable." }, { status: 400 });
  }

  if (settings.stripe_payment_model && settings.stripe_payment_model !== "direct_charge_v2") {
    return NextResponse.json({ success: false, message: "Unsupported Stripe payment model." }, { status: 409 });
  }

  const provisioningKey = settings.stripe_connect_provisioning_key || `bpd-connect-${randomUUID()}`;
  let accountId = settings.stripe_connected_account_id as string | null;

  try {
    if (!accountId) {
      await supabase
        .from("business_settings")
        .update({
          stripe_connect_provisioning_status: "provisioning",
          stripe_connect_provisioning_key: provisioningKey,
          stripe_connect_provisioning_started_at: new Date().toISOString(),
          stripe_connect_provisioning_error: null,
        })
        .eq("id", settings.id);

      const created = await createConnectedMerchantAccount({
        contactEmail: settings.business_email || settings.inquiry_recipient_email,
        displayName: settings.business_display_name || settings.business_name || "Bridget Pope Designs",
        idempotencyKey: provisioningKey,
      });
      accountId = String(created.id);

      await supabase
        .from("business_settings")
        .update({
          stripe_connected_account_id: accountId,
          stripe_payment_model: "direct_charge_v2",
          stripe_connect_provisioning_status: "account_created",
          stripe_connect_provisioning_error: null,
        })
        .eq("id", settings.id);
    }

    const account = await retrieveConnectedMerchantAccount(accountId);
    const snapshot = await syncSettings(supabase, settings.id, account);

    await supabase.from("activity_logs").insert({
      actor_id: owner.profile.id,
      action: "stripe_connect_status_checked",
      entity_type: "business_settings",
      entity_id: settings.id,
      metadata: {
        connected_account_id: accountId,
        payment_model: "direct_charge_v2",
        card_payments_status: snapshot.cardPaymentsStatus,
        payouts_status: snapshot.payoutsStatus,
        ready: snapshot.ready,
      },
    });

    if (snapshot.ready) {
      return NextResponse.json({ success: true, ready: true, accountId });
    }

    const origin = appUrl();
    const link = await createConnectedAccountOnboardingLink({
      accountId,
      returnUrl: `${origin}/admin/settings/payments?stripe=returned`,
      refreshUrl: `${origin}/api/admin/payments/connect/refresh`,
    });

    return NextResponse.json({ success: true, ready: false, accountId, url: link.url });
  } catch (error) {
    const message = safeError(error);
    await supabase
      .from("business_settings")
      .update({
        stripe_connect_provisioning_status: accountId ? "onboarding_required" : "failed",
        stripe_connect_provisioning_error: message.slice(0, 1000),
        payment_readiness_status: "action_required",
      })
      .eq("id", settings.id);

    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

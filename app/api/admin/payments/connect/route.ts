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

const CONNECT_FAILURE_MESSAGE = "Stripe setup could not be completed right now. Please try again.";

async function syncSettings(supabase: ReturnType<typeof createAdminClient>, settingsId: string, account: any) {
  const snapshot = mapConnectedAccountSnapshot(account);
  const readiness = snapshot.ready ? "ready" : "action_required";
  const provisioningStatus = snapshot.ready ? "ready" : "onboarding_required";
  const disabledReason = snapshot.cardPaymentsStatus === "active" ? null : "card_payments_not_active";

  const { error } = await supabase
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

  if (error) throw new Error(`Unable to persist Stripe readiness: ${error.message}`);
  return snapshot;
}

async function claimProvisioningKey(
  supabase: ReturnType<typeof createAdminClient>,
  settingsId: string,
  existingKey: string | null,
) {
  if (existingKey) return existingKey;

  const candidateKey = `bpd-connect-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("business_settings")
    .update({
      stripe_connect_provisioning_status: "provisioning",
      stripe_connect_provisioning_key: candidateKey,
      stripe_connect_provisioning_started_at: startedAt,
      stripe_connect_provisioning_error: null,
    })
    .eq("id", settingsId)
    .is("stripe_connected_account_id", null)
    .is("stripe_connect_provisioning_key", null)
    .select("stripe_connect_provisioning_key")
    .maybeSingle();

  if (claimError) throw new Error(`Unable to claim Stripe provisioning: ${claimError.message}`);
  if (claimed?.stripe_connect_provisioning_key) return String(claimed.stripe_connect_provisioning_key);

  const { data: current, error: reloadError } = await supabase
    .from("business_settings")
    .select("stripe_connected_account_id,stripe_connect_provisioning_key")
    .eq("id", settingsId)
    .maybeSingle();
  if (reloadError) throw new Error(`Unable to reload Stripe provisioning state: ${reloadError.message}`);
  if (current?.stripe_connected_account_id) return null;
  if (!current?.stripe_connect_provisioning_key) {
    throw new Error("Stripe provisioning could not be claimed.");
  }
  return String(current.stripe_connect_provisioning_key);
}

async function persistConnectedAccount(
  supabase: ReturnType<typeof createAdminClient>,
  settingsId: string,
  provisioningKey: string,
  accountId: string,
) {
  const { data: saved, error: saveError } = await supabase
    .from("business_settings")
    .update({
      stripe_connected_account_id: accountId,
      stripe_payment_model: "direct_charge_v2",
      stripe_connect_provisioning_status: "account_created",
      stripe_connect_provisioning_error: null,
    })
    .eq("id", settingsId)
    .is("stripe_connected_account_id", null)
    .eq("stripe_connect_provisioning_key", provisioningKey)
    .select("stripe_connected_account_id")
    .maybeSingle();

  if (saveError) throw new Error(`Unable to persist connected Stripe account: ${saveError.message}`);
  if (saved?.stripe_connected_account_id === accountId) return accountId;

  const { data: current, error: reloadError } = await supabase
    .from("business_settings")
    .select("stripe_connected_account_id")
    .eq("id", settingsId)
    .maybeSingle();
  if (reloadError) throw new Error(`Unable to verify connected Stripe account: ${reloadError.message}`);
  if (current?.stripe_connected_account_id !== accountId) {
    throw new Error("Connected Stripe account state changed during provisioning.");
  }
  return accountId;
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

  let accountId = settings.stripe_connected_account_id as string | null;
  let provisioningKey = settings.stripe_connect_provisioning_key as string | null;

  try {
    if (!accountId) {
      provisioningKey = await claimProvisioningKey(supabase, settings.id, provisioningKey);

      if (!provisioningKey) {
        const { data: current, error: currentError } = await supabase
          .from("business_settings")
          .select("stripe_connected_account_id,stripe_connect_provisioning_key")
          .eq("id", settings.id)
          .maybeSingle();
        if (currentError) throw new Error(`Unable to reload Stripe account state: ${currentError.message}`);
        accountId = current?.stripe_connected_account_id ?? null;
        provisioningKey = current?.stripe_connect_provisioning_key ?? null;
      }

      if (!accountId) {
        if (!provisioningKey) throw new Error("Stripe provisioning key is unavailable.");
        const created = await createConnectedMerchantAccount({
          contactEmail: settings.business_email || settings.inquiry_recipient_email,
          displayName: settings.business_display_name || settings.business_name || "Bridget Pope Designs",
          idempotencyKey: provisioningKey,
        });
        accountId = String(created.id);
        await persistConnectedAccount(supabase, settings.id, provisioningKey, accountId);
      }
    }

    const account = await retrieveConnectedMerchantAccount(accountId);
    const snapshot = await syncSettings(supabase, settings.id, account);

    const { error: activityError } = await supabase.from("activity_logs").insert({
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
    if (activityError) {
      console.warn("Unable to write Stripe Connect activity log", { message: activityError.message });
    }

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
    console.error("Stripe Connect provisioning failed", {
      settingsId: settings.id,
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });

    const { error: statusError } = await supabase
      .from("business_settings")
      .update({
        stripe_connect_provisioning_status: accountId ? "onboarding_required" : "failed",
        stripe_connect_provisioning_error: CONNECT_FAILURE_MESSAGE,
        payment_readiness_status: "action_required",
      })
      .eq("id", settings.id);
    if (statusError) {
      console.error("Unable to persist Stripe Connect failure state", { message: statusError.message });
    }

    return NextResponse.json({ success: false, message: CONNECT_FAILURE_MESSAGE }, { status: 502 });
  }
}

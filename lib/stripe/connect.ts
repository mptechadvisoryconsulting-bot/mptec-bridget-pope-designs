import type Stripe from "stripe";
import { appUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";

export const STRIPE_PAYMENT_MODEL = "destination_charges";

export type StripeConnectSettings = {
  id: string;
  business_email?: string | null;
  stripe_connected_account_id?: string | null;
  stripe_payment_model?: string | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_details_submitted?: boolean | null;
  stripe_requirements_currently_due?: string[] | null;
  stripe_requirements_disabled_reason?: string | null;
  stripe_account_last_synced_at?: string | null;
  payment_readiness_status?: string | null;
  platform_fee_basis_points?: number | string | null;
};

type SupabaseAdmin = {
  from(table: string): any;
};

export function isStripeReady(settings?: StripeConnectSettings | null) {
  return Boolean(
    settings?.stripe_connected_account_id &&
      settings.stripe_payment_model === STRIPE_PAYMENT_MODEL &&
      settings.stripe_charges_enabled &&
      settings.stripe_payouts_enabled,
  );
}

export function stripeReadinessStatus(settings?: Partial<StripeConnectSettings> | null) {
  if (!settings?.stripe_connected_account_id) return "not_connected";
  if (settings.stripe_requirements_disabled_reason) return "restricted";
  if (settings.stripe_charges_enabled && settings.stripe_payouts_enabled) return "ready";
  if (settings.stripe_charges_enabled && !settings.stripe_payouts_enabled) return "payout_issue";
  return "onboarding_required";
}

export async function getOrCreateBusinessSettings(supabase: SupabaseAdmin): Promise<StripeConnectSettings> {
  const { data: existing, error } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("business_settings")
    .insert({
      business_name: "Bridget Pope Designs",
      business_phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "(629) 295-4210",
      business_email: process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL ?? null,
      timezone: "America/Chicago",
      stripe_payment_model: STRIPE_PAYMENT_MODEL,
    })
    .select("*")
    .single();

  if (createError || !created) throw new Error(createError?.message ?? "Unable to create business settings");
  return created;
}

function accountPayload(account: Stripe.Account) {
  const payload = {
    stripe_connected_account_id: account.id,
    stripe_payment_model: STRIPE_PAYMENT_MODEL,
    stripe_charges_enabled: Boolean(account.charges_enabled),
    stripe_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_details_submitted: Boolean(account.details_submitted),
    stripe_requirements_currently_due: account.requirements?.currently_due ?? [],
    stripe_requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
    stripe_account_last_synced_at: new Date().toISOString(),
  };

  return {
    ...payload,
    payment_readiness_status: stripeReadinessStatus(payload),
  };
}

export async function syncStripeConnectAccount(supabase: SupabaseAdmin, accountId: string) {
  const account = await getStripe().accounts.retrieve(accountId);
  const settings = await getOrCreateBusinessSettings(supabase);
  const payload = accountPayload(account);
  const { data, error } = await supabase
    .from("business_settings")
    .update(payload)
    .eq("id", settings.id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to sync Stripe account");
  return data as StripeConnectSettings;
}

export async function ensureStripeConnectAccount(supabase: SupabaseAdmin) {
  const settings = await getOrCreateBusinessSettings(supabase);

  if (settings.stripe_connected_account_id) {
    return syncStripeConnectAccount(supabase, settings.stripe_connected_account_id);
  }

  const account = await getStripe().accounts.create({
    type: "express",
    country: "US",
    email: settings.business_email ?? process.env.OWNER_EMAIL ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      business: "bridget-pope-designs",
      payment_model: STRIPE_PAYMENT_MODEL,
    },
  });

  const { error } = await supabase
    .from("business_settings")
    .update(accountPayload(account))
    .eq("id", settings.id);

  if (error) throw new Error(error.message);
  return syncStripeConnectAccount(supabase, account.id);
}

export async function createStripeConnectOnboardingLink(accountId: string) {
  return getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    collect: "eventually_due",
    refresh_url: `${appUrl()}/admin/settings/payments?stripe=refresh`,
    return_url: `${appUrl()}/admin/settings/payments?stripe=return`,
  });
}

export async function getStripeReadiness(supabase: SupabaseAdmin) {
  const settings = await getOrCreateBusinessSettings(supabase);
  const synced = settings.stripe_connected_account_id
    ? await syncStripeConnectAccount(supabase, settings.stripe_connected_account_id)
    : settings;

  return {
    settings: synced,
    ready: isStripeReady(synced),
    paymentModel: STRIPE_PAYMENT_MODEL,
  };
}

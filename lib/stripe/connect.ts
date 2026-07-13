import type Stripe from "stripe";
import { randomUUID } from "crypto";
import { appUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { ConnectStageError, ProvisioningConflictError, ProvisioningLeaseConflictError } from "@/lib/stripe/connect-stage-error";
import { runStage, toConnectStageError } from "@/lib/stripe/connect-errors";

export const DESTINATION_CHARGE_V1 = "destination_charge_v1";
export const DIRECT_CHARGE_V2 = "direct_charge_v2";
export const LEGACY_DESTINATION_CHARGES = "destination_charges";
export const STRIPE_PAYMENT_MODEL = DIRECT_CHARGE_V2;
export const SUPPORTED_PAYMENT_MODELS = new Set([DESTINATION_CHARGE_V1, DIRECT_CHARGE_V2, LEGACY_DESTINATION_CHARGES]);

/** Finite provisioning lease duration. A `provisioning` row older than this is considered abandoned and may be reclaimed. */
export const PROVISIONING_LEASE_MS = 15 * 60 * 1000;

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
  stripe_connect_provisioning_status?: string | null;
  stripe_connect_provisioning_key?: string | null;
  stripe_connect_provisioning_started_at?: string | null;
  stripe_connect_provisioning_error?: string | null;
  stripe_connect_provisioned_at?: string | null;
  payment_readiness_status?: string | null;
  platform_fee_basis_points?: number | string | null;
};

type SupabaseAdmin = {
  from(table: string): any;
};

export function isStripeReady(settings?: StripeConnectSettings | null) {
  return Boolean(
    settings?.stripe_connected_account_id &&
      settings.stripe_charges_enabled &&
      settings.stripe_payouts_enabled,
  );
}

export function normalizePaymentModel(value?: string | null) {
  if (!value || value === LEGACY_DESTINATION_CHARGES) return DESTINATION_CHARGE_V1;
  return value;
}

export function stripeReadinessStatus(settings?: Partial<StripeConnectSettings> | null) {
  if (!settings?.stripe_connected_account_id) return "not_connected";
  if (settings.stripe_requirements_disabled_reason) return "restricted";
  if (settings.stripe_charges_enabled && settings.stripe_payouts_enabled) return "ready";
  if (settings.stripe_charges_enabled && !settings.stripe_payouts_enabled) return "payout_issue";
  return "onboarding_required";
}

function isLeaseStale(startedAt?: string | null) {
  if (!startedAt) return true;
  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) return true;
  return Date.now() - startedMs > PROVISIONING_LEASE_MS;
}

async function loadBusinessSettingsRow(supabase: SupabaseAdmin): Promise<StripeConnectSettings> {
  const { data: existing, error } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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

  if (createError) throw createError;
  if (!created) throw new Error("Unable to create business settings");
  return created;
}

/** Loads (or creates) the single business settings row. Stage: `business_settings_load`. */
export async function getOrCreateBusinessSettings(supabase: SupabaseAdmin, correlationId = randomUUID()): Promise<StripeConnectSettings> {
  return runStage("business_settings_load", correlationId, () => loadBusinessSettingsRow(supabase));
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
    stripe_connect_provisioning_status: stripeReadinessStatus(payload) === "ready" ? "ready" : "onboarding_required",
    stripe_connect_provisioning_error: null,
    stripe_connect_provisioned_at: new Date().toISOString(),
  };
}

/** Retrieves + persists an already-known connected account. Never calls `accounts.create()`. */
async function retrieveAndPersistExistingAccount(
  supabase: SupabaseAdmin,
  settings: StripeConnectSettings,
  correlationId: string,
): Promise<StripeConnectSettings> {
  const accountId = settings.stripe_connected_account_id as string;

  // If Stripe cannot find the stored account id (wrong mode, wrong platform, deleted), fail
  // closed here. Do NOT fall through to account creation — that would silently abandon or
  // duplicate the owner's real connected account.
  const account = await runStage("connect_account_retrieve", correlationId, () => getStripe().accounts.retrieve(accountId));

  return runStage("connect_account_persist", correlationId, async () => {
    const { data, error } = await supabase
      .from("business_settings")
      .update(accountPayload(account))
      .eq("id", settings.id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Unable to persist Stripe connected account");
    return data as StripeConnectSettings;
  });
}

/**
 * Bounded search of platform-accessible connected accounts for one matching the trusted
 * `provisioning_key` metadata this application stamped on account creation. Stripe has no
 * search-by-metadata API for Connect accounts, so this pages through recently created
 * accounts (bounded) and filters client-side.
 */
async function findConnectedAccountsByProvisioningKey(provisioningKey: string): Promise<Stripe.Account[]> {
  const stripe = getStripe();
  const matches: Stripe.Account[] = [];
  let startingAfter: string | undefined;
  // Bound tightly: recovery only needs recently created platform accounts for this app.
  const MAX_PAGES = 2;
  const PAGE_SIZE = 100;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const list = await stripe.accounts.list({ limit: PAGE_SIZE, starting_after: startingAfter });

    for (const account of list.data) {
      if (
        account.metadata?.provisioning_key === provisioningKey &&
        account.metadata?.business === "bridget-pope-designs"
      ) {
        matches.push(account);
      }
    }

    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }

  return matches;
}

/**
 * Recovery path for a row stuck in `provisioning` with a stored provisioning key but no
 * connected account id (e.g. Stripe account creation succeeded but persistence failed).
 * Returns the recovered settings row, or `null` if no platform-accessible account matches.
 * Throws (fail closed) if more than one account matches.
 */
function isStripeConnectionFailure(error: unknown) {
  if (error instanceof ConnectStageError) {
    return error.stripeErrorType === "StripeConnectionError" || error.safeCode === "STRIPE_PROVIDER_UNAVAILABLE";
  }
  if (!error || typeof error !== "object") return false;
  const type = "type" in error ? String((error as { type?: unknown }).type ?? "") : "";
  return type === "StripeConnectionError";
}

async function tryRecoverProvisioningAccount(
  supabase: SupabaseAdmin,
  settings: StripeConnectSettings,
  correlationId: string,
): Promise<StripeConnectSettings | null> {
  const provisioningKey = settings.stripe_connect_provisioning_key as string;

  let matches: Stripe.Account[];
  try {
    matches = await runStage("connect_account_recover", correlationId, () =>
      findConnectedAccountsByProvisioningKey(provisioningKey),
    );
  } catch (error) {
    // accounts.list is best-effort recovery. A Stripe transport failure must not permanently
    // deadlock a stale provisioning lease — the caller may reclaim and create once.
    if (isStripeConnectionFailure(error) && isLeaseStale(settings.stripe_connect_provisioning_started_at)) {
      console.error("Stripe Connect recovery skipped after provider connection failure on stale lease", {
        stage: "connect_account_recover",
        correlationId,
        stripeErrorType: error instanceof ConnectStageError ? error.stripeErrorType : "StripeConnectionError",
        stripeRequestId: error instanceof ConnectStageError ? error.stripeRequestId : undefined,
      });
      return null;
    }
    throw error;
  }

  if (matches.length > 1) {
    throw toConnectStageError("connect_account_recover", new ProvisioningLeaseConflictError(), correlationId);
  }

  if (matches.length === 0) return null;

  const [recoveredAccount] = matches;
  return runStage("connect_account_persist", correlationId, async () => {
    const { data, error } = await supabase
      .from("business_settings")
      .update({
        ...accountPayload(recoveredAccount),
        stripe_connect_provisioning_key: provisioningKey,
      })
      .eq("id", settings.id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Unable to persist recovered Stripe connected account");
    return data as StripeConnectSettings;
  });
}

type ProvisioningClaim = { settingsId: string; provisioningKey: string; businessEmail?: string | null };

/**
 * Atomically claims the provisioning lease: only succeeds when no account id is stored and
 * the row is not already actively `provisioning` (or its lease has gone stale). This is the
 * compare-and-swap that guarantees two concurrent requests cannot both create an account.
 */
async function claimProvisioningLease(
  supabase: SupabaseAdmin,
  settings: StripeConnectSettings,
  correlationId: string,
): Promise<ProvisioningClaim> {
  return runStage("connect_provisioning_claim", correlationId, async () => {
    const provisioningKey = randomUUID();
    const nowIso = new Date().toISOString();
    const staleCutoffIso = new Date(Date.now() - PROVISIONING_LEASE_MS).toISOString();

    // Quote the ISO timestamp for PostgREST — unquoted values break on `:` / `+` / `.`
    // and silently fail the stale-lease reclaim filter.
    const staleCutoffQuoted = `"${staleCutoffIso}"`;

    const { data: claimed, error } = await supabase
      .from("business_settings")
      .update({
        stripe_connect_provisioning_status: "provisioning",
        stripe_connect_provisioning_key: provisioningKey,
        stripe_connect_provisioning_started_at: nowIso,
        stripe_connect_provisioning_error: null,
        stripe_payment_model: STRIPE_PAYMENT_MODEL,
      })
      .eq("id", settings.id)
      .is("stripe_connected_account_id", null)
      .or(
        `stripe_connect_provisioning_status.is.null,stripe_connect_provisioning_status.in.(not_started,failed),and(stripe_connect_provisioning_status.eq.provisioning,stripe_connect_provisioning_started_at.lt.${staleCutoffQuoted})`,
      )
      .select("id,business_email")
      .maybeSingle();

    if (error) throw error;

    if (!claimed) {
      throw new ProvisioningConflictError();
    }

    return { settingsId: settings.id, provisioningKey, businessEmail: claimed.business_email ?? settings.business_email };
  });
}

/** Creates exactly one new Stripe connected account and persists it, guarded by the provisioning claim. */
async function createAndPersistAccount(
  supabase: SupabaseAdmin,
  claim: ProvisioningClaim,
  correlationId: string,
): Promise<StripeConnectSettings> {
  const account = await runStage("connect_account_create", correlationId, () =>
    getStripe().accounts.create({
      type: "express",
      country: "US",
      email: claim.businessEmail ?? process.env.OWNER_EMAIL ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        business: "bridget-pope-designs",
        payment_model: STRIPE_PAYMENT_MODEL,
        provisioning_key: claim.provisioningKey,
      },
    }),
  );

  return runStage("connect_account_persist", correlationId, async () => {
    const { data, error } = await supabase
      .from("business_settings")
      .update({
        ...accountPayload(account),
        stripe_connect_provisioning_key: claim.provisioningKey,
        stripe_connect_provisioning_status: "account_created",
      })
      .eq("id", claim.settingsId)
      .eq("stripe_connect_provisioning_key", claim.provisioningKey)
      .is("stripe_connected_account_id", null)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (data) return data as StripeConnectSettings;

    // Our claim's own compare-and-swap lost the race (e.g. a stale-lease reclaim by another
    // request superseded us after we had already called accounts.create()). Never treat the
    // account we just created as the account of record if someone else already persisted one:
    // reuse whichever account is now on file instead of creating a second usable reference.
    const latest = await loadBusinessSettingsRow(supabase);
    if (latest.stripe_connected_account_id) {
      console.error("Stripe Connect provisioning race detected: newly created account was superseded", {
        stage: "connect_account_persist",
        correlationId,
        supersededAccountId: account.id,
      });
      return latest;
    }

    throw new Error("Unable to persist Stripe connected account");
  });
}

async function provisionOrRecoverAccount(
  supabase: SupabaseAdmin,
  settings: StripeConnectSettings,
  correlationId: string,
): Promise<StripeConnectSettings> {
  if (settings.stripe_connect_provisioning_key) {
    const recovered = await tryRecoverProvisioningAccount(supabase, settings, correlationId);
    if (recovered) return recovered;

    // No platform account matches the stored key. Only proceed to claim/create if the
    // existing lease is stale; otherwise another in-flight request still owns it.
    if (settings.stripe_connect_provisioning_status === "provisioning" && !isLeaseStale(settings.stripe_connect_provisioning_started_at)) {
      throw toConnectStageError("connect_provisioning_claim", new ProvisioningConflictError(), correlationId);
    }
  }

  const claim = await claimProvisioningLease(supabase, settings, correlationId);
  return createAndPersistAccount(supabase, claim, correlationId);
}

/**
 * Ensures a usable Stripe connected account exists for the business, reusing any existing
 * account and safely recovering/claiming provisioning as needed. Never overwrites a stored
 * connected account id, and never creates more than one new account per successful call.
 */
export async function ensureStripeConnectAccount(supabase: SupabaseAdmin, correlationId = randomUUID()): Promise<StripeConnectSettings> {
  const settings = await getOrCreateBusinessSettings(supabase, correlationId);

  if (settings.stripe_connected_account_id) {
    return retrieveAndPersistExistingAccount(supabase, settings, correlationId);
  }

  return provisionOrRecoverAccount(supabase, settings, correlationId);
}

/** Retrieves the current Stripe account state and syncs it into the settings row. Stage: `connect_status_sync`. */
export async function syncStripeConnectAccount(
  supabase: SupabaseAdmin,
  accountId: string,
  correlationId = randomUUID(),
): Promise<StripeConnectSettings> {
  return runStage("connect_status_sync", correlationId, async () => {
    const account = await getStripe().accounts.retrieve(accountId);
    const settings = await loadBusinessSettingsRow(supabase);
    const payload = accountPayload(account);
    const { data, error } = await supabase
      .from("business_settings")
      .update(payload)
      .eq("id", settings.id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Unable to sync Stripe account");
    return data as StripeConnectSettings;
  });
}

export async function createStripeConnectOnboardingLink(accountId: string) {
  return getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    collect: "eventually_due",
    refresh_url: `${appUrl()}/api/admin/stripe/connect/refresh`,
    return_url: `${appUrl()}/api/admin/stripe/connect/return`,
  });
}

export async function createStripeConnectManagementLink(accountId: string) {
  return getStripe().accounts.createLoginLink(accountId);
}

export async function getStripeReadiness(supabase: SupabaseAdmin, correlationId = randomUUID()) {
  const settings = await getOrCreateBusinessSettings(supabase, correlationId);
  const synced = settings.stripe_connected_account_id
    ? await syncStripeConnectAccount(supabase, settings.stripe_connected_account_id, correlationId)
    : settings;

  return {
    settings: synced,
    ready: isStripeReady(synced),
    paymentModel: STRIPE_PAYMENT_MODEL,
  };
}

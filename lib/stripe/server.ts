import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STRIPE_API_BASE = "https://api.stripe.com";
const STRIPE_API_VERSION = "2026-06-24.dahlia";
const WEBHOOK_TOLERANCE_SECONDS = 300;
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

export type StripeConnectedAccountSnapshot = {
  id: string;
  cardPaymentsStatus: string | null;
  payoutsStatus: string | null;
  requirementsCurrentlyDue: string[];
  ready: boolean;
};

function requireStripeSecretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new Error("Stripe is not configured on this deployment.");
  return value;
}

export function stripeServerConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

function safeStripeError(payload: any, fallback: string) {
  const message = payload?.error?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function stripeRequestSignal() {
  return AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS);
}

function throwStripeNetworkError(error: unknown): never {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    throw new Error("Stripe is temporarily unavailable. Please try again.");
  }
  throw error;
}

async function stripeJsonRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    connectedAccountId?: string;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireStripeSecretKey()}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.connectedAccountId) headers["Stripe-Account"] = options.connectedAccountId;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: stripeRequestSignal(),
    });
  } catch (error) {
    throwStripeNetworkError(error);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(safeStripeError(payload, `Stripe request failed (${response.status}).`));
  }
  return payload as T;
}

async function stripeFormRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    params?: URLSearchParams;
    connectedAccountId?: string;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireStripeSecretKey()}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (options.params) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (options.connectedAccountId) headers["Stripe-Account"] = options.connectedAccountId;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: options.method ?? (options.params ? "POST" : "GET"),
      headers,
      body: options.params?.toString(),
      cache: "no-store",
      signal: stripeRequestSignal(),
    });
  } catch (error) {
    throwStripeNetworkError(error);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(safeStripeError(payload, `Stripe request failed (${response.status}).`));
  }
  return payload as T;
}

function requirementNames(account: any) {
  const entries = Array.isArray(account?.requirements?.entries) ? account.requirements.entries : [];
  return entries
    .filter((entry: any) => {
      const status = entry?.minimum_deadline?.status;
      return status === "currently_due" || status === "past_due";
    })
    .map((entry: any) => String(entry?.field ?? entry?.type ?? "requirement"));
}

export function mapConnectedAccountSnapshot(account: any): StripeConnectedAccountSnapshot {
  const merchantCapabilities = account?.configuration?.merchant?.capabilities;
  const cardPaymentsStatus = merchantCapabilities?.card_payments?.status ?? null;
  const payoutsStatus = merchantCapabilities?.stripe_balance?.payouts?.status ?? null;
  const requirementsCurrentlyDue = requirementNames(account);
  return {
    id: String(account?.id ?? ""),
    cardPaymentsStatus,
    payoutsStatus,
    requirementsCurrentlyDue,
    ready: cardPaymentsStatus === "active" && payoutsStatus === "active" && requirementsCurrentlyDue.length === 0,
  };
}

export async function createConnectedMerchantAccount(input: {
  contactEmail?: string | null;
  displayName: string;
  idempotencyKey: string;
}) {
  return stripeJsonRequest<any>("/v2/core/accounts", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: {
      contact_email: input.contactEmail || undefined,
      display_name: input.displayName,
      dashboard: "full",
      identity: { country: "us" },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
      },
      defaults: {
        currency: "usd",
        responsibilities: {
          fees_collector: "stripe",
          losses_collector: "stripe",
        },
        locales: ["en-US"],
      },
      metadata: {
        platform_site: "bridget-pope-designs",
        payment_model: "direct_charge_v2",
      },
      include: ["configuration.merchant", "identity", "requirements", "defaults"],
    },
  });
}

export async function retrieveConnectedMerchantAccount(accountId: string) {
  const include = ["configuration.merchant", "identity", "requirements", "defaults"]
    .map((value) => `include[]=${encodeURIComponent(value)}`)
    .join("&");
  return stripeJsonRequest<any>(`/v2/core/accounts/${encodeURIComponent(accountId)}?${include}`);
}

export async function createConnectedAccountOnboardingLink(input: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}) {
  return stripeJsonRequest<{ url: string }>("/v2/core/account_links", {
    method: "POST",
    body: {
      account: input.accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          collection_options: { fields: "eventually_due" },
          configurations: ["merchant"],
          return_url: input.returnUrl,
          refresh_url: input.refreshUrl,
        },
      },
    },
  });
}

function integrationIdentifier() {
  const suffix = randomBytes(8)
    .toString("base64url")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 8)
    .padEnd(8, "x");
  return `bridget_po_designs_${suffix}`;
}

export async function createConnectedCheckoutSession(input: {
  accountId: string;
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
  clientId: string;
  customerEmail?: string | null;
  amountCents: number;
  applicationFeeCents: number;
  platformFeeBasisPoints: number;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("client_reference_id", input.invoiceId);
  params.set("integration_identifier", integrationIdentifier());
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][product_data][name]", `Invoice ${input.invoiceNumber} balance`);
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  params.set("line_items[0][quantity]", "1");
  params.set("payment_intent_data[application_fee_amount]", String(input.applicationFeeCents));
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  if (input.customerEmail) params.set("customer_email", input.customerEmail);

  const metadata: Record<string, string> = {
    invoice_id: input.invoiceId,
    project_id: input.projectId,
    client_id: input.clientId,
    payment_model: "direct_charge_v2",
    platform_fee_basis_points: String(input.platformFeeBasisPoints),
    platform_fee_cents: String(input.applicationFeeCents),
  };
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
    params.set(`payment_intent_data[metadata][${key}]`, value);
  }

  return stripeFormRequest<any>("/v1/checkout/sessions", {
    method: "POST",
    params,
    connectedAccountId: input.accountId,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function retrieveConnectedCheckoutSession(accountId: string, sessionId: string) {
  return stripeFormRequest<any>(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    connectedAccountId: accountId,
  });
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  const timestampNumber = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampNumber) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((signature) => {
    try {
      const candidate = Buffer.from(signature, "hex");
      return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
    } catch {
      return false;
    }
  });
}

import Stripe from "stripe";
import { ConfigurationError, requireEnv } from "@/lib/env";

let stripeClient: Stripe | null = null;

function resolveStripeSecretKey() {
  const raw = requireEnv("STRIPE_SECRET_KEY").trim().replace(/^["']+|["']+$/g, "");
  if (!raw) {
    throw new ConfigurationError("STRIPE_SECRET_KEY is required");
  }
  if (!raw.startsWith("sk_live_") && !raw.startsWith("sk_test_") && !raw.startsWith("rk_live_") && !raw.startsWith("rk_test_")) {
    throw new ConfigurationError("STRIPE_SECRET_KEY must be a Stripe secret or restricted key");
  }
  return raw;
}

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

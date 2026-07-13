import { describe, expect, it, vi } from "vitest";
import { isValidStripeRedirectUrl, requestPaymentSetupApi } from "@/lib/payment-setup-client";

describe("payment setup client requests", () => {
  it("accepts Stripe-hosted redirects", () => {
    expect(isValidStripeRedirectUrl("https://connect.stripe.com/setup/s/acct_123")).toBe(true);
    expect(isValidStripeRedirectUrl("https://dashboard.stripe.com/express/acct_123")).toBe(true);
    expect(isValidStripeRedirectUrl("http://connect.stripe.com/setup/s/acct_123")).toBe(false);
    expect(isValidStripeRedirectUrl("https://example.com/setup")).toBe(false);
  });

  it("returns the owner-only message for 403 responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "Server detail" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }));

    const result = await requestPaymentSetupApi("/api/admin/stripe/connect/onboarding", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({ ok: false, message: "Server detail", status: 403 }));
  });

  it("handles HTML responses as invalid API responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>error</html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    }));

    const result = await requestPaymentSetupApi("/api/admin/stripe/connect/onboarding", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: "INVALID_API_RESPONSE",
      message: "Payment setup returned an invalid response.",
    }));
  });

  it("handles malformed JSON responses as invalid API responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("{", {
      status: 500,
      headers: { "content-type": "application/json" },
    }));

    const result = await requestPaymentSetupApi("/api/admin/stripe/connect/onboarding", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: "INVALID_API_RESPONSE",
      message: "Payment setup returned an invalid response.",
    }));
  });

  it("handles network failures with a resettable error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await requestPaymentSetupApi("/api/admin/stripe/connect/onboarding", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: "NETWORK_ERROR",
      message: "Unable to reach payment setup. Please try again.",
    }));
  });

  it("aborts requests that exceed the timeout", async () => {
    const fetchImpl = vi.fn((_path: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );

    const result = await requestPaymentSetupApi("/api/admin/stripe/connect/onboarding", { fetchImpl, timeoutMs: 1 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: "REQUEST_TIMEOUT",
      message: "Stripe setup took too long to respond. Please try again.",
    }));
  });

  it("rejects non-Stripe success URLs", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ url: "https://example.com/not-stripe" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const result = await requestPaymentSetupApi("/api/admin/stripe/connect/onboarding", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: "INVALID_REDIRECT_URL",
      message: "Payment setup returned an invalid response.",
    }));
  });
});

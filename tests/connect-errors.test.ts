import { describe, expect, it } from "vitest";
import { mapStripeConnectError, stripeConnectErrorResponse, toConnectStageError } from "@/lib/stripe/connect-errors";
import { ConnectStageError, ProvisioningConflictError, ProvisioningLeaseConflictError } from "@/lib/stripe/connect-stage-error";

function stripeError(overrides: Record<string, unknown>) {
  return {
    message: "A Stripe error occurred.",
    ...overrides,
  };
}

describe("mapStripeConnectError", () => {
  it("maps connect_account_create + Stripe authentication error to STRIPE_AUTHENTICATION_ERROR", () => {
    const error = stripeError({ type: "StripeAuthenticationError", code: "invalid_api_key" });
    expect(mapStripeConnectError("connect_account_create", error)).toEqual(
      expect.objectContaining({ code: "STRIPE_AUTHENTICATION_ERROR", status: 503 }),
    );
  });

  it("maps connect_account_create + Connect/platform configuration error to STRIPE_CONNECT_CONFIGURATION_ERROR", () => {
    const error = stripeError({ type: "StripePermissionError", code: "account_invalid", message: "This platform is not enabled for Connect." });
    expect(mapStripeConnectError("connect_account_create", error)).toEqual(
      expect.objectContaining({ code: "STRIPE_CONNECT_CONFIGURATION_ERROR", status: 503 }),
    );
  });

  it("maps connect_account_retrieve + resource_missing to STRIPE_CONNECTED_ACCOUNT_ERROR", () => {
    const error = stripeError({ type: "StripeInvalidRequestError", code: "resource_missing", message: "No such account: acct_123" });
    expect(mapStripeConnectError("connect_account_retrieve", error)).toEqual(
      expect.objectContaining({ code: "STRIPE_CONNECTED_ACCOUNT_ERROR", status: 409 }),
    );
  });

  it("maps connect_account_link_create + Stripe invalid request to STRIPE_ACCOUNT_LINK_ERROR", () => {
    const error = stripeError({ type: "StripeInvalidRequestError", code: "parameter_invalid_empty" });
    expect(mapStripeConnectError("connect_account_link_create", error)).toEqual(
      expect.objectContaining({ code: "STRIPE_ACCOUNT_LINK_ERROR", status: 502 }),
    );
  });

  it("maps a Supabase missing-column/relation/schema error to DATABASE_CONFIGURATION_ERROR at business_settings_load", () => {
    const error = { code: "42703", message: 'column "stripe_connect_provisioning_status" does not exist' };
    expect(mapStripeConnectError("business_settings_load", error)).toEqual(
      expect.objectContaining({ code: "DATABASE_CONFIGURATION_ERROR", status: 500 }),
    );
  });

  it("maps a Supabase schema error to DATABASE_CONFIGURATION_ERROR even at the account-link stage (proves stage+type classification, not string matching)", () => {
    const error = { code: "42P01", message: 'relation "bpd_business_settings" does not exist' };
    expect(mapStripeConnectError("connect_account_link_create", error)).toEqual(
      expect.objectContaining({ code: "DATABASE_CONFIGURATION_ERROR", status: 500 }),
    );
  });

  it("maps a database error at connect_account_persist to DATABASE_CONFIGURATION_ERROR", () => {
    const error = { code: "42703", message: 'column "stripe_connected_account_id" does not exist' };
    expect(mapStripeConnectError("connect_account_persist", error)).toEqual(
      expect.objectContaining({ code: "DATABASE_CONFIGURATION_ERROR", status: 500 }),
    );
  });

  it("maps a provisioning claim conflict to STRIPE_PROVISIONING_IN_PROGRESS", () => {
    expect(mapStripeConnectError("connect_provisioning_claim", new ProvisioningConflictError())).toEqual(
      expect.objectContaining({ code: "STRIPE_PROVISIONING_IN_PROGRESS", status: 409 }),
    );
  });

  it("maps a provisioning lease conflict (multiple matching accounts) to STRIPE_PROVISIONING_CONFLICT", () => {
    expect(mapStripeConnectError("connect_account_recover", new ProvisioningLeaseConflictError())).toEqual(
      expect.objectContaining({ code: "STRIPE_PROVISIONING_CONFLICT", status: 409 }),
    );
  });

  it("does not misclassify an unrelated error at connect_account_link_create as a database error", () => {
    const error = stripeError({ type: "StripeConnectionError", code: undefined, message: "Network timeout" });
    const mapped = mapStripeConnectError("connect_account_link_create", error);
    expect(mapped.code).not.toBe("DATABASE_CONFIGURATION_ERROR");
  });

  it("falls back to a stage-scoped generic error for unrecognized errors", () => {
    const mapped = mapStripeConnectError("business_settings_load", new Error("boom"));
    expect(mapped.code).toBe("STRIPE_SETTINGS_LOAD_ERROR");
  });
});

describe("toConnectStageError", () => {
  it("preserves the original stage when the error is already a ConnectStageError", () => {
    const original = new ConnectStageError({
      stage: "business_settings_load",
      safeCode: "DATABASE_CONFIGURATION_ERROR",
      message: "Payment setup could not load.",
      httpStatus: 500,
      correlationId: "11111111-1111-1111-1111-111111111111",
    });

    // Even though we pass a *different* fallback stage here, the original stage must win —
    // this is exactly what stops every failure from being reported as connect_account_link_create.
    const result = toConnectStageError("connect_account_link_create", original);

    expect(result).toBe(original);
    expect(result.stage).toBe("business_settings_load");
    expect(result.safeCode).toBe("DATABASE_CONFIGURATION_ERROR");
  });

  it("wraps a raw error with the given stage and a correlation id", () => {
    const result = toConnectStageError("connect_account_retrieve", stripeError({ type: "StripeInvalidRequestError", code: "resource_missing" }));
    expect(result.stage).toBe("connect_account_retrieve");
    expect(result.safeCode).toBe("STRIPE_CONNECTED_ACCOUNT_ERROR");
    expect(result.correlationId).toBeTruthy();
    expect(result.stripeErrorCode).toBe("resource_missing");
  });
});

describe("stripeConnectErrorResponse", () => {
  it("returns success:false, code, message, stage, and correlationId", async () => {
    const response = stripeConnectErrorResponse(
      stripeError({ type: "StripeInvalidRequestError", code: "resource_missing" }),
      "connect_account_retrieve",
      "22222222-2222-2222-2222-222222222222",
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        code: "STRIPE_CONNECTED_ACCOUNT_ERROR",
        stage: "connect_account_retrieve",
        correlationId: "22222222-2222-2222-2222-222222222222",
      }),
    );
    expect(typeof body.message).toBe("string");
  });

  it("never leaks the raw Stripe secret key or error internals into the response", async () => {
    const response = stripeConnectErrorResponse(
      new Error("Request failed with STRIPE_SECRET_KEY=sk_live_should_never_appear"),
      "connect_account_create",
    );
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("sk_live_should_never_appear");
  });
});

import { NextResponse } from "next/server";

export type SafeStripeApiError = {
  code: string;
  message: string;
  status: number;
};

type StripeLikeError = {
  code?: string;
  message?: string;
  raw?: { code?: string; requestId?: string; type?: string };
  requestId?: string;
  statusCode?: number;
  type?: string;
};

function isStripeLikeError(error: unknown): error is StripeLikeError {
  return Boolean(error && typeof error === "object");
}

function errorConstructorName(error: unknown) {
  return error && typeof error === "object" && "constructor" in error ? error.constructor?.name : undefined;
}

export function mapStripeConnectError(error: unknown, operation: string): SafeStripeApiError {
  const fallback = {
    code: "PAYMENT_SETUP_ERROR",
    message: "Unable to complete payment setup. Please try again.",
    status: 500,
  };

  if (!isStripeLikeError(error)) return fallback;

  const type = error.type ?? error.raw?.type;
  const code = error.code ?? error.raw?.code;
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (operation.includes("status") && (type?.startsWith("Stripe") || code || message.includes("stripe"))) {
    return {
      code: "STRIPE_STATUS_ERROR",
      message: "Unable to refresh Stripe payment status.",
      status: 502,
    };
  }

  if (message.includes("stripe_secret_key") || message.includes("stripe is not configured") || errorConstructorName(error) === "ConfigurationError") {
    return {
      code: "STRIPE_CONFIGURATION_ERROR",
      message: "Payment provider configuration is missing.",
      status: 503,
    };
  }

  if (type === "StripeAuthenticationError" || code === "api_key_expired" || code === "invalid_api_key") {
    return {
      code: "STRIPE_AUTHENTICATION_ERROR",
      message: "Payment provider configuration needs attention.",
      status: 503,
    };
  }

  if (type === "StripeInvalidRequestError" && (code === "resource_missing" || message.includes("no such account"))) {
    return {
      code: "STRIPE_CONNECTED_ACCOUNT_ERROR",
      message: "The connected Stripe account could not be found. Please reconnect payment setup.",
      status: 409,
    };
  }

  if (operation.includes("account_link")) {
    return {
      code: "STRIPE_ACCOUNT_LINK_ERROR",
      message: "Unable to create Stripe onboarding link. Please try again.",
      status: 502,
    };
  }

  if (operation.includes("login_link")) {
    return {
      code: "STRIPE_LOGIN_LINK_ERROR",
      message: "Unable to open Stripe account management. Please try again.",
      status: 502,
    };
  }

  if (message.includes("column") || message.includes("relation") || message.includes("schema") || message.includes("business_settings")) {
    return {
      code: "DATABASE_CONFIGURATION_ERROR",
      message: "Payment setup could not load. The production payment configuration needs attention.",
      status: 500,
    };
  }

  return fallback;
}

export function logSafeStripeConnectError(operation: string, error: unknown) {
  const stripeError = isStripeLikeError(error) ? error : null;
  console.error("Stripe Connect operation failed", {
    operation,
    errorType: stripeError?.type ?? stripeError?.raw?.type ?? errorConstructorName(error) ?? "UnknownError",
    code: stripeError?.code ?? stripeError?.raw?.code,
    requestId: stripeError?.requestId ?? stripeError?.raw?.requestId,
  });
}

export function stripeConnectErrorResponse(error: unknown, operation: string) {
  logSafeStripeConnectError(operation, error);
  const mapped = mapStripeConnectError(error, operation);
  return NextResponse.json(
    {
      success: false,
      code: mapped.code,
      message: mapped.message,
    },
    { status: mapped.status },
  );
}

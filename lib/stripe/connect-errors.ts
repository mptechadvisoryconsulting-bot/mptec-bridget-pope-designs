import { NextResponse } from "next/server";
import {
  ConnectStageError,
  type ConnectStage,
  extractStripeErrorInfo,
} from "@/lib/stripe/connect-stage-error";

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
  return error && typeof error === "object" && "constructor" in error
    ? (error as { constructor?: { name?: string } }).constructor?.name
    : undefined;
}

function safeMessage(error: unknown) {
  if (isStripeLikeError(error) && typeof error.message === "string") return error.message.toLowerCase();
  return "";
}

/** Postgres/PostgREST error codes for missing tables, columns, or schemas (class 42, 3F). */
function isPostgresSchemaErrorCode(code: unknown) {
  return typeof code === "string" && /^(42|3F)/.test(code);
}

function isDatabaseSchemaError(error: unknown, message: string) {
  if (!isStripeLikeError(error)) return false;
  if (isPostgresSchemaErrorCode(error.code)) return true;

  return (
    message.includes("column") ||
    message.includes("relation") ||
    message.includes(" schema") ||
    message.startsWith("schema") ||
    message.includes("business_settings") ||
    message.includes("does not exist")
  );
}

/** Stages where the acted-upon id is a stored Stripe connected account id. */
const ACCOUNT_DEPENDENT_STAGES: ConnectStage[] = [
  "connect_account_retrieve",
  "connect_account_link_create",
  "connect_login_link_create",
  "connect_status_sync",
  "connect_account_recover",
];

function isConnectConfigurationError(type: string | undefined, code: string | undefined, message: string) {
  if (type === "StripePermissionError") return true;
  if (code === "platform_account_required") return true;
  if (message.includes("signed up for connect")) return true;
  if (message.includes("connect") && (message.includes("not enabled") || message.includes("capabilit") || message.includes("platform") || message.includes("dashboard.stripe.com/connect"))) {
    return true;
  }
  return false;
}

const STAGE_FALLBACK: Record<ConnectStage, SafeStripeApiError> = {
  business_settings_load: {
    code: "STRIPE_SETTINGS_LOAD_ERROR",
    message: "Unable to load payment settings. Please try again.",
    status: 500,
  },
  connect_account_retrieve: {
    code: "STRIPE_CONNECTED_ACCOUNT_ERROR",
    message: "Unable to verify the connected Stripe account. Please try again.",
    status: 502,
  },
  connect_provisioning_claim: {
    code: "STRIPE_PROVISIONING_ERROR",
    message: "Unable to start Stripe account provisioning. Please try again.",
    status: 500,
  },
  connect_account_create: {
    code: "STRIPE_ACCOUNT_CREATE_ERROR",
    message: "Unable to create the Stripe connected account. Please try again.",
    status: 502,
  },
  connect_account_persist: {
    code: "DATABASE_CONFIGURATION_ERROR",
    message: "The Stripe connected account could not be saved. Please try again.",
    status: 500,
  },
  connect_account_link_create: {
    code: "STRIPE_ACCOUNT_LINK_ERROR",
    message: "Unable to create Stripe onboarding link. Please try again.",
    status: 502,
  },
  connect_provisioning_status_update: {
    code: "STRIPE_PROVISIONING_ERROR",
    message: "Unable to update Stripe provisioning status. Please try again.",
    status: 500,
  },
  connect_activity_log: {
    code: "STRIPE_ACTIVITY_LOG_ERROR",
    message: "The Stripe activity log entry failed to record.",
    status: 500,
  },
  connect_account_recover: {
    code: "STRIPE_CONNECTED_ACCOUNT_ERROR",
    message: "Unable to recover the Stripe connected account. Please try again.",
    status: 502,
  },
  connect_login_link_create: {
    code: "STRIPE_LOGIN_LINK_ERROR",
    message: "Unable to open Stripe account management. Please try again.",
    status: 502,
  },
  connect_status_sync: {
    code: "STRIPE_STATUS_ERROR",
    message: "Unable to refresh Stripe payment status. Please try again.",
    status: 502,
  },
};

/**
 * Classifies an error into a safe API response based on the **stage that actually failed**
 * plus the error's own type/code — never on whether an operation string happens to contain
 * a substring like "account_link". This is what prevents a database or provisioning failure
 * from being misreported as a Stripe Account Link failure.
 */
export function mapStripeConnectError(stage: ConnectStage, error: unknown): SafeStripeApiError {
  const fallback = STAGE_FALLBACK[stage] ?? {
    code: "PAYMENT_SETUP_ERROR",
    message: "Unable to complete payment setup. Please try again.",
    status: 500,
  };

  const message = safeMessage(error);
  const constructorName = errorConstructorName(error);

  // Domain-level provisioning recovery conflicts are not Stripe errors; classify by marker first.
  if (constructorName === "ProvisioningConflictError") {
    return {
      code: "STRIPE_PROVISIONING_IN_PROGRESS",
      message: "Stripe account provisioning is already in progress. Please refresh payment status before trying again.",
      status: 409,
    };
  }

  if (constructorName === "ProvisioningLeaseConflictError") {
    return {
      code: "STRIPE_PROVISIONING_CONFLICT",
      message: "Multiple Stripe connected accounts matched provisioning recovery. Operator review is required before continuing.",
      status: 409,
    };
  }

  // Database/schema errors can occur at any stage and must never be reported as a Stripe
  // Account Link failure just because the failing stage happens to be link creation.
  if (isDatabaseSchemaError(error, message)) {
    return {
      code: "DATABASE_CONFIGURATION_ERROR",
      message: "Payment setup could not load. The production payment configuration needs attention.",
      status: 500,
    };
  }

  if (!isStripeLikeError(error)) return fallback;

  const type = error.type ?? error.raw?.type;
  const code = error.code ?? error.raw?.code;

  if (message.includes("stripe_secret_key") || message.includes("stripe is not configured") || constructorName === "ConfigurationError") {
    return { code: "STRIPE_CONFIGURATION_ERROR", message: "Payment provider configuration is missing.", status: 503 };
  }

  if (type === "StripeAuthenticationError" || code === "api_key_expired" || code === "invalid_api_key") {
    return { code: "STRIPE_AUTHENTICATION_ERROR", message: "Payment provider configuration needs attention.", status: 503 };
  }

  if (type === "StripeConnectionError" || type === "StripeAPIError" && !code) {
    return {
      code: "STRIPE_PROVIDER_UNAVAILABLE",
      message: "Stripe is temporarily unreachable. Please try payment setup again in a moment.",
      status: 502,
    };
  }

  if (code === "resource_missing" && ACCOUNT_DEPENDENT_STAGES.includes(stage)) {
    return {
      code: "STRIPE_CONNECTED_ACCOUNT_ERROR",
      message: "The connected Stripe account could not be found. Reconnect payment setup to continue.",
      status: 409,
    };
  }

  if (stage === "connect_account_create" && isConnectConfigurationError(type, code, message)) {
    return {
      code: "STRIPE_CONNECT_CONFIGURATION_ERROR",
      message: "Stripe Connect is not enabled for this platform yet. Complete Connect signup in the Stripe Dashboard, then try Set Up Payments again.",
      status: 503,
    };
  }

  if (stage === "connect_account_link_create" && type === "StripeInvalidRequestError") {
    return { code: "STRIPE_ACCOUNT_LINK_ERROR", message: "Unable to create Stripe onboarding link. Please try again.", status: 502 };
  }

  if (stage === "connect_login_link_create" && type === "StripeInvalidRequestError") {
    return { code: "STRIPE_LOGIN_LINK_ERROR", message: "Unable to open Stripe account management. Please try again.", status: 502 };
  }

  return fallback;
}

/** Converts any thrown value into a `ConnectStageError` tagged with the given stage, unless it is already staged. */
export function toConnectStageError(stage: ConnectStage, error: unknown, correlationId?: string): ConnectStageError {
  if (error instanceof ConnectStageError) return error;

  const mapped = mapStripeConnectError(stage, error);
  return new ConnectStageError({
    stage,
    safeCode: mapped.code,
    message: mapped.message,
    httpStatus: mapped.status,
    cause: error,
    correlationId,
  });
}

/** Runs `fn`, converting any thrown error into a `ConnectStageError` tagged with `stage`. */
export async function runStage<T>(stage: ConnectStage, correlationId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toConnectStageError(stage, error, correlationId);
  }
}

/** Logs safe diagnostic metadata only: stage, safe code, correlation id, Stripe type/code/request id. Never secrets. */
export function logSafeStripeConnectError(error: ConnectStageError) {
  const cause = error.cause;
  const causeMessage =
    cause && typeof cause === "object" && "message" in cause && typeof (cause as { message?: unknown }).message === "string"
      ? String((cause as { message: string }).message).slice(0, 240)
      : undefined;
  const nested =
    cause && typeof cause === "object" && "cause" in cause && (cause as { cause?: unknown }).cause && typeof (cause as { cause?: unknown }).cause === "object"
      ? ((cause as { cause: Record<string, unknown> }).cause as Record<string, unknown>)
      : null;
  const networkCode =
    nested && typeof nested.code === "string"
      ? nested.code
      : cause && typeof cause === "object" && "code" in cause && typeof (cause as { code?: unknown }).code === "string"
        ? String((cause as { code: string }).code)
        : undefined;

  console.error("Stripe Connect operation failed", {
    stage: error.stage,
    code: error.safeCode,
    correlationId: error.correlationId,
    stripeErrorType: error.stripeErrorType,
    stripeErrorCode: error.stripeErrorCode,
    stripeRequestId: error.stripeRequestId,
    httpStatus: error.httpStatus,
    causeMessage,
    networkCode,
    stripeKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripeKeyMode: process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live")
      ? "live"
      : process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test")
        ? "test"
        : process.env.STRIPE_SECRET_KEY?.trim().startsWith("rk_")
          ? "restricted"
          : process.env.STRIPE_SECRET_KEY
            ? "unexpected_prefix"
            : "missing",
  });
}

/** Builds the safe JSON error response for a Stripe Connect route: success, code, message, stage, correlationId. */
export function stripeConnectErrorResponse(error: unknown, stage: ConnectStage, correlationId?: string) {
  const stageError = toConnectStageError(stage, error, correlationId);
  logSafeStripeConnectError(stageError);

  return NextResponse.json(
    {
      success: false,
      code: stageError.safeCode,
      message: stageError.message,
      stage: stageError.stage,
      correlationId: stageError.correlationId,
      ...(stageError.stripeErrorType ? { stripeErrorType: stageError.stripeErrorType } : {}),
      ...(stageError.stripeErrorCode ? { stripeErrorCode: stageError.stripeErrorCode } : {}),
      ...(stageError.stripeRequestId ? { stripeRequestId: stageError.stripeRequestId } : {}),
    },
    { status: stageError.httpStatus ?? 500 },
  );
}

export { extractStripeErrorInfo };
export type { ConnectStage };

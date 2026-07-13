import { randomUUID } from "crypto";

/**
 * Every provider/database operation in the Stripe Connect onboarding workflow must be
 * wrapped with one of these stages so that failures are attributed to the step that
 * actually failed, instead of being reported as a generic Account Link error.
 */
export const CONNECT_STAGES = [
  "business_settings_load",
  "connect_account_retrieve",
  "connect_provisioning_claim",
  "connect_account_create",
  "connect_account_persist",
  "connect_account_link_create",
  "connect_provisioning_status_update",
  "connect_activity_log",
  "connect_account_recover",
  "connect_login_link_create",
  "connect_status_sync",
] as const;

export type ConnectStage = (typeof CONNECT_STAGES)[number];

export function isConnectStage(value: unknown): value is ConnectStage {
  return typeof value === "string" && (CONNECT_STAGES as readonly string[]).includes(value);
}

type StripeLikeError = {
  code?: string;
  message?: string;
  type?: string;
  requestId?: string;
  statusCode?: number;
  raw?: { code?: string; message?: string; type?: string; requestId?: string; statusCode?: number };
};

function isStripeLikeError(error: unknown): error is StripeLikeError {
  return Boolean(error && typeof error === "object");
}

/** Pulls only the safe-to-log Stripe diagnostic fields off an unknown error, never secrets. */
export function extractStripeErrorInfo(error: unknown) {
  if (!isStripeLikeError(error)) {
    return { type: undefined, code: undefined, requestId: undefined, statusCode: undefined };
  }

  return {
    type: error.type ?? error.raw?.type,
    code: error.code ?? error.raw?.code,
    requestId: error.requestId ?? error.raw?.requestId,
    statusCode: error.statusCode ?? error.raw?.statusCode,
  };
}

export type ConnectStageErrorOptions = {
  stage: ConnectStage;
  safeCode: string;
  message: string;
  cause?: unknown;
  httpStatus?: number;
  correlationId?: string;
};

/**
 * Typed internal error for every Stripe Connect onboarding stage. Carries only safe
 * diagnostic metadata (stage, safe code, correlation id, Stripe error type/code/request id,
 * HTTP status). `cause` may hold the original error for server-side logging, but nothing on
 * this error should ever be built from secrets (API keys, webhook signing secrets, bank data).
 */
export class ConnectStageError extends Error {
  readonly stage: ConnectStage;
  readonly safeCode: string;
  readonly cause?: unknown;
  readonly stripeErrorType?: string;
  readonly stripeErrorCode?: string;
  readonly stripeRequestId?: string;
  readonly httpStatus?: number;
  readonly correlationId: string;

  constructor(options: ConnectStageErrorOptions) {
    super(options.message);
    this.name = "ConnectStageError";
    this.stage = options.stage;
    this.safeCode = options.safeCode;
    this.cause = options.cause;
    this.httpStatus = options.httpStatus;
    this.correlationId = options.correlationId ?? randomUUID();

    const stripeInfo = extractStripeErrorInfo(options.cause);
    this.stripeErrorType = stripeInfo.type;
    this.stripeErrorCode = stripeInfo.code;
    this.stripeRequestId = stripeInfo.requestId;
    if (this.httpStatus === undefined) this.httpStatus = stripeInfo.statusCode;
  }
}

/**
 * Thrown when a provisioning claim attempt finds the lease already held by another
 * in-flight request. Maps to `STRIPE_PROVISIONING_IN_PROGRESS`.
 */
export class ProvisioningConflictError extends Error {
  constructor(message = "Stripe account provisioning is already in progress. Please refresh payment status before trying again.") {
    super(message);
    this.name = "ProvisioningConflictError";
  }
}

/**
 * Thrown when provisioning recovery finds more than one platform-accessible connected
 * account matching the stored provisioning key. Never auto-resolved; requires operator
 * review. Maps to `STRIPE_PROVISIONING_CONFLICT`.
 */
export class ProvisioningLeaseConflictError extends Error {
  constructor(message = "Multiple Stripe connected accounts matched provisioning recovery. Operator review required.") {
    super(message);
    this.name = "ProvisioningLeaseConflictError";
  }
}


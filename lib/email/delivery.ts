import { hasEmailEnv } from "@/lib/env";
import { resend } from "@/lib/email/resend";

type SupabaseAdmin = {
  from(table: string): any;
};

export type EmailDeliveryResult = {
  status: "sent" | "not_configured" | "failed";
  messageId?: string | null;
  error?: string | null;
};

/** Public, uppercase status contract for API consumers. Internal storage/state stays lowercase. */
export type ApiEmailDeliveryStatus = "SENT" | "NOT_CONFIGURED" | "FAILED";

export type EmailReadinessStatus = "NOT_CONFIGURED" | "READY" | "PROVIDER_ERROR" | "SENDER_VERIFICATION_REQUIRED";

type SendTrackedEmailInput = Parameters<typeof resend.emails.send>[0] & {
  supabase?: SupabaseAdmin;
  settingsId?: string | null;
};

/** Maps the internal lowercase delivery status to the uppercase contract API responses should expose. */
export function toApiEmailStatus(status: EmailDeliveryResult["status"]): ApiEmailDeliveryStatus {
  switch (status) {
    case "sent":
      return "SENT";
    case "not_configured":
      return "NOT_CONFIGURED";
    case "failed":
    default:
      return "FAILED";
  }
}

const SENDER_VERIFICATION_ERROR_PATTERNS = [/verify/i, /verified/i, /domain/i, /sender identity/i, /from address/i];

/**
 * Maps the DB readiness column (and the most recent error, if any) to the four owner-facing
 * readiness states. `failed` DB rows are split into PROVIDER_ERROR vs SENDER_VERIFICATION_REQUIRED
 * based on the recorded error text, since Resend/most ESPs surface sender/domain verification
 * failures as a distinct, actionable condition.
 */
export function mapEmailReadinessStatus(
  dbStatus: string | null | undefined,
  lastError?: string | null,
): EmailReadinessStatus {
  if (dbStatus === "ready") return "READY";

  if (dbStatus === "failed") {
    if (lastError && SENDER_VERIFICATION_ERROR_PATTERNS.some((pattern) => pattern.test(lastError))) {
      return "SENDER_VERIFICATION_REQUIRED";
    }
    return "PROVIDER_ERROR";
  }

  return "NOT_CONFIGURED";
}

/** Shared owner-facing label for the four-value readiness enum, so every surface (dashboard, settings) reads the same text. */
export function readinessLabel(status: EmailReadinessStatus): string {
  switch (status) {
    case "READY":
      return "Ready";
    case "SENDER_VERIFICATION_REQUIRED":
      return "Sender verification required";
    case "PROVIDER_ERROR":
      return "Provider error";
    default:
      return "Not configured";
  }
}

/** Strips likely secrets/tokens from a provider error message before it is ever displayed. */
export function redactEmailError(message?: string | null): string | null {
  if (!message) return null;
  return message.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]").slice(0, 300);
}

async function recordEmailProviderResult(
  supabase: SupabaseAdmin | undefined,
  settingsId: string | null | undefined,
  result: EmailDeliveryResult,
) {
  if (!supabase || !settingsId) return;

  if (result.status === "sent") {
    await supabase
      .from("business_settings")
      .update({
        email_provider_last_success_at: new Date().toISOString(),
        email_provider_last_message_id: result.messageId ?? null,
        email_provider_last_error: null,
        email_readiness_status: "ready",
      })
      .eq("id", settingsId);
    return;
  }

  await supabase
    .from("business_settings")
    .update({
      email_provider_last_failure_at: new Date().toISOString(),
      email_provider_last_error: result.error ?? "Email provider is not configured.",
      email_readiness_status: result.status,
    })
    .eq("id", settingsId);
}

export async function sendTrackedEmail(input: SendTrackedEmailInput): Promise<EmailDeliveryResult> {
  const { supabase, settingsId, ...emailInput } = input;

  if (!hasEmailEnv()) {
    const result: EmailDeliveryResult = {
      status: "not_configured",
      error: "RESEND_API_KEY must be configured before email can be sent.",
    };
    await recordEmailProviderResult(supabase, settingsId, result);
    return result;
  }

  try {
    const response = await resend.emails.send(emailInput);
    const error = "error" in response ? response.error : null;
    if (error) {
      throw new Error(typeof error === "string" ? error : error.message);
    }

    const messageId = "data" in response ? response.data?.id : null;
    const result: EmailDeliveryResult = { status: "sent", messageId };
    await recordEmailProviderResult(supabase, settingsId, result);
    return result;
  } catch (error) {
    const result: EmailDeliveryResult = {
      status: "failed",
      error: error instanceof Error ? error.message : "Unable to send email.",
    };
    await recordEmailProviderResult(supabase, settingsId, result);
    return result;
  }
}

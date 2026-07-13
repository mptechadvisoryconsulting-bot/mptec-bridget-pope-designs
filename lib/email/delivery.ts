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

type SendTrackedEmailInput = Parameters<typeof resend.emails.send>[0] & {
  supabase?: SupabaseAdmin;
  settingsId?: string | null;
};

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
      error: "RESEND_API_KEY and EMAIL_FROM must be configured before email can be sent.",
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

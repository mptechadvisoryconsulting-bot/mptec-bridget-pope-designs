import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeReadiness } from "@/lib/stripe/connect";
import { logSafeStripeConnectError, toConnectStageError } from "@/lib/stripe/connect-errors";

function paymentsSettingsUrl(params: Record<string, string>) {
  const url = new URL(`${appUrl()}/admin/settings/payments`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

/**
 * `return_url` for the onboarding Account Link. Returning from Stripe does NOT mean
 * onboarding is complete — this route re-retrieves and syncs the connected account so
 * readiness is derived from live Stripe state, then redirects the owner back to the
 * payment settings page.
 */
export async function GET() {
  const correlationId = randomUUID();

  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const supabase = createAdminClient();
    await getStripeReadiness(supabase, correlationId);

    return NextResponse.redirect(paymentsSettingsUrl({ stripe: "returned", correlationId }));
  } catch (error) {
    const stageError = toConnectStageError("connect_status_sync", error, correlationId);
    logSafeStripeConnectError(stageError);
    return NextResponse.redirect(
      paymentsSettingsUrl({ stripe: "error", code: stageError.safeCode, stage: stageError.stage, correlationId: stageError.correlationId }),
    );
  }
}

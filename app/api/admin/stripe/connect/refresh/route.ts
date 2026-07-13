import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeConnectOnboardingLink, ensureStripeConnectAccount } from "@/lib/stripe/connect";
import { logSafeStripeConnectError, runStage, toConnectStageError } from "@/lib/stripe/connect-errors";

function paymentsSettingsUrl(params: Record<string, string>) {
  const url = new URL(`${appUrl()}/admin/settings/payments`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

/**
 * Stripe Account Links are single-use and short-lived. This route is the `refresh_url` for
 * the onboarding Account Link: it creates a brand-new link server-side and redirects the
 * authenticated owner to Stripe. It never reuses a previously issued Account Link URL.
 */
export async function GET() {
  const correlationId = randomUUID();

  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const supabase = createAdminClient();
    const settings = await ensureStripeConnectAccount(supabase, correlationId);

    if (!settings.stripe_connected_account_id) {
      return NextResponse.redirect(
        paymentsSettingsUrl({ stripe: "error", code: "STRIPE_CONNECTED_ACCOUNT_ERROR", correlationId }),
      );
    }

    const link = await runStage("connect_account_link_create", correlationId, () =>
      createStripeConnectOnboardingLink(settings.stripe_connected_account_id as string),
    );

    return NextResponse.redirect(link.url);
  } catch (error) {
    const stageError = toConnectStageError("connect_account_link_create", error, correlationId);
    logSafeStripeConnectError(stageError);
    return NextResponse.redirect(
      paymentsSettingsUrl({ stripe: "error", code: stageError.safeCode, stage: stageError.stage, correlationId: stageError.correlationId }),
    );
  }
}

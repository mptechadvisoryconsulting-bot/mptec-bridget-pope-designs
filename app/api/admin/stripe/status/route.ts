import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeReadiness } from "@/lib/stripe/connect";
import { stripeConnectErrorResponse } from "@/lib/stripe/connect-errors";

export async function GET() {
  try {
    const owner = await requireOwnerProfile();
    if (owner.error) return owner.error;

    const readiness = await getStripeReadiness(createAdminClient());
    const accountId = readiness.settings.stripe_connected_account_id;
    return NextResponse.json({
      success: true,
      message: readiness.ready ? "Stripe payments and payouts are ready." : "Stripe payment status refreshed. Setup still needs attention.",
      ...readiness,
      settings: {
        ...readiness.settings,
        stripe_connected_account_id: accountId ? `acct_...${accountId.slice(-4)}` : null,
      },
    });
  } catch (error) {
    return stripeConnectErrorResponse(error, "stripe_status_refresh");
  }
}

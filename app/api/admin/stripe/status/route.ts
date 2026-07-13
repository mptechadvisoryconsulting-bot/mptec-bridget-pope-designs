import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeReadiness } from "@/lib/stripe/connect";

export async function GET() {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  const readiness = await getStripeReadiness(createAdminClient());
  const accountId = readiness.settings.stripe_connected_account_id;
  return NextResponse.json({
    success: true,
    ...readiness,
    settings: {
      ...readiness.settings,
      stripe_connected_account_id: accountId ? `acct_...${accountId.slice(-4)}` : null,
    },
  });
}

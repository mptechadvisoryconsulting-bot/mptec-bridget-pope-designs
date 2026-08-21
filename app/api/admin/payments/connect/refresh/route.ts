import { NextResponse } from "next/server";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConnectedAccountOnboardingLink } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select("stripe_connected_account_id")
    .limit(1)
    .maybeSingle();

  const accountId = settings?.stripe_connected_account_id;
  if (!accountId) {
    return NextResponse.redirect(`${appUrl()}/admin/settings/payments?stripe=not-connected`);
  }

  try {
    const origin = appUrl();
    const link = await createConnectedAccountOnboardingLink({
      accountId,
      returnUrl: `${origin}/admin/settings/payments?stripe=returned`,
      refreshUrl: `${origin}/api/admin/payments/connect/refresh`,
    });
    return NextResponse.redirect(link.url);
  } catch {
    return NextResponse.redirect(`${appUrl()}/admin/settings/payments?stripe=setup-error`);
  }
}

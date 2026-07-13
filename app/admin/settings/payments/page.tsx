import { PaymentSetupCard } from "@/components/admin/PaymentSetupCard";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeReadinessStatus } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const { profile } = await getCurrentProfile();
  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select("stripe_connected_account_id,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,stripe_account_last_synced_at,payment_readiness_status,platform_fee_basis_points")
    .limit(1)
    .maybeSingle();

  const status = stripeReadinessStatus(settings);
  const accountId = settings?.stripe_connected_account_id ? `****${settings.stripe_connected_account_id.slice(-4)}` : null;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Settings</span>
          <h1>Payment Setup</h1>
        </div>
      </div>
      <div className="dashboard-grid">
        <PaymentSetupCard
          accountLastSyncedAt={settings?.stripe_account_last_synced_at}
          canManage={profile?.role === "owner"}
          chargesEnabled={Boolean(settings?.stripe_charges_enabled)}
          connectedAccountId={accountId}
          detailsSubmitted={Boolean(settings?.stripe_details_submitted)}
          paymentReadinessStatus={status}
          payoutsEnabled={Boolean(settings?.stripe_payouts_enabled)}
          platformFeeBasisPoints={Number(settings?.platform_fee_basis_points ?? 100)}
          requirementsCurrentlyDue={settings?.stripe_requirements_currently_due ?? []}
          requirementsDisabledReason={settings?.stripe_requirements_disabled_reason}
        />
      </div>
    </div>
  );
}

import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile } = await getCurrentProfile();
  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select("business_email,inquiry_recipient_email,stripe_connected_account_id,stripe_payment_model,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,stripe_account_last_synced_at,email_last_test_sent_at,email_last_error,email_provider_last_error,email_readiness_status,platform_fee_basis_points")
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Business Settings</span>
          <h1>Settings</h1>
        </div>
      </div>
      <AdminSettingsForm
        businessEmail={settings?.inquiry_recipient_email ?? settings?.business_email ?? process.env.OWNER_EMAIL ?? ""}
        currentRole={profile?.role ?? "admin"}
        emailLastError={settings?.email_provider_last_error ?? settings?.email_last_error}
        emailLastTestSentAt={settings?.email_last_test_sent_at}
        emailReadinessStatus={settings?.email_readiness_status ?? "not_configured"}
        platformFeeBasisPoints={settings?.platform_fee_basis_points ?? 100}
        stripeSettings={{
          connectedAccountId: settings?.stripe_connected_account_id ? `acct_...${settings.stripe_connected_account_id.slice(-4)}` : null,
          paymentModel: settings?.stripe_payment_model ?? "destination_charges",
          chargesEnabled: Boolean(settings?.stripe_charges_enabled),
          payoutsEnabled: Boolean(settings?.stripe_payouts_enabled),
          detailsSubmitted: Boolean(settings?.stripe_details_submitted),
          requirementsCurrentlyDue: settings?.stripe_requirements_currently_due ?? [],
          requirementsDisabledReason: settings?.stripe_requirements_disabled_reason ?? null,
          accountLastSyncedAt: settings?.stripe_account_last_synced_at ?? null,
        }}
      />
    </div>
  );
}

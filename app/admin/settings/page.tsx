import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select("business_email,stripe_connected_account_id,stripe_payment_model,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,stripe_account_last_synced_at,email_last_test_sent_at,email_last_error")
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
        businessEmail={settings?.business_email ?? process.env.OWNER_EMAIL ?? ""}
        emailLastError={settings?.email_last_error}
        emailLastTestSentAt={settings?.email_last_test_sent_at}
        stripeSettings={{
          connectedAccountId: settings?.stripe_connected_account_id ?? null,
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

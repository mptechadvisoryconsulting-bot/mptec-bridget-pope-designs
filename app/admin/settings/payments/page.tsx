import { PaymentSetupCard } from "@/components/admin/PaymentSetupCard";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeReadinessStatus } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

type PaymentSettingsPageProps = {
  searchParams: Promise<{ stripe?: string; code?: string; stage?: string; correlationId?: string }>;
};

export default async function PaymentSettingsPage({ searchParams }: PaymentSettingsPageProps) {
  const { stripe: stripeRedirectStatus, code: redirectCode, stage: redirectStage, correlationId: redirectCorrelationId } = await searchParams;
  const { profile } = await getCurrentProfile();
  const { data: settings, error: settingsError } = await createAdminClient()
    .from("business_settings")
    .select("stripe_connected_account_id,stripe_payment_model,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,stripe_account_last_synced_at,payment_readiness_status,platform_fee_basis_points")
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    console.error("Payment setup settings query failed", {
      operation: "payment_settings_load",
      code: settingsError.code,
      message: settingsError.message,
    });
  }

  const status = stripeReadinessStatus(settings);
  const accountId = settings?.stripe_connected_account_id ? `****${settings.stripe_connected_account_id.slice(-4)}` : null;

  const initialNotice =
    stripeRedirectStatus === "returned"
      ? { kind: "success" as const, message: "You're back from Stripe. Payment status was refreshed from the latest Stripe account state." }
      : stripeRedirectStatus === "error"
        ? {
            kind: "error" as const,
            message: "Stripe onboarding could not continue. Please try again.",
            stage: redirectStage,
            correlationId: redirectCorrelationId,
            code: redirectCode,
          }
        : null;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Settings</span>
          <h1>Payment Setup</h1>
        </div>
      </div>
      <div className="dashboard-grid">
        {settingsError ? (
          <section className="panel span-2">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Owner Payment Setup</span>
                <h2>Stripe Connect Payouts</h2>
              </div>
              <span className="status">CONFIGURATION_ERROR</span>
            </div>
            <p className="form-error">Payment setup could not load. The production payment configuration needs attention.</p>
            <p className="mini-meta">Required Stripe Connect/payment readiness schema could not be read. Set Up Payments is disabled until the database migration is applied.</p>
          </section>
        ) : (
          <PaymentSetupCard
            accountLastSyncedAt={settings?.stripe_account_last_synced_at}
            canManage={profile?.role === "owner"}
            chargesEnabled={Boolean(settings?.stripe_charges_enabled)}
            connectedAccountId={accountId}
            detailsSubmitted={Boolean(settings?.stripe_details_submitted)}
            initialNotice={initialNotice}
            paymentReadinessStatus={status}
            payoutsEnabled={Boolean(settings?.stripe_payouts_enabled)}
            platformFeeBasisPoints={Number(settings?.platform_fee_basis_points ?? 100)}
            requirementsCurrentlyDue={settings?.stripe_requirements_currently_due ?? []}
            requirementsDisabledReason={settings?.stripe_requirements_disabled_reason}
          />
        )}
      </div>
    </div>
  );
}

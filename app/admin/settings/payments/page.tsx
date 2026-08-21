import { StripeConnectSetupButton } from "@/components/payments/StripeConnectSetupButton";
import { ButtonLink } from "@/components/ui/button";
import { basisPointsToPercent, normalizePlatformFeeBasisPoints } from "@/lib/payments/platform-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeServerConfigured, stripeWebhookConfigured } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select(
      "stripe_connected_account_id,stripe_payment_model,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_account_last_synced_at,stripe_connect_provisioning_status,stripe_connect_provisioning_error,payment_readiness_status,platform_fee_basis_points",
    )
    .limit(1)
    .maybeSingle();

  let feeBasisPoints = 100;
  try {
    feeBasisPoints = normalizePlatformFeeBasisPoints(settings?.platform_fee_basis_points);
  } catch {
    feeBasisPoints = 100;
  }
  const feePercent = basisPointsToPercent(feeBasisPoints);
  const stripeReady = Boolean(
    settings?.stripe_connected_account_id &&
      settings?.stripe_payment_model === "direct_charge_v2" &&
      settings?.payment_readiness_status === "ready" &&
      settings?.stripe_charges_enabled &&
      settings?.stripe_payouts_enabled,
  );
  const accountLabel = settings?.stripe_connected_account_id
    ? `••••${String(settings.stripe_connected_account_id).slice(-6)}`
    : "Not linked";

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Settings</span>
          <h1>Billing & Payments</h1>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel span-2">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Stripe Connect</span>
              <h2>Online payments</h2>
            </div>
            <span className="status">{stripeReady ? "Ready" : "Setup required"}</span>
          </div>
          <p>
            Customer card payments are created directly on Bridget Pope Designs&apos; connected Stripe account.
            MP Tech receives only the configured application fee; the customer&apos;s gross payment is not collected into the MP Tech account first.
          </p>
          <ul className="list" style={{ marginTop: 16 }}>
            <li><span>Connected merchant</span><span className="status">{accountLabel}</span></li>
            <li><span>Payment model</span><span className="status">Direct charge</span></li>
            <li><span>MP Tech application fee</span><span className="status">{feePercent}%</span></li>
            <li><span>Card payments</span><span className="status">{settings?.stripe_charges_enabled ? "Active" : "Not active"}</span></li>
            <li><span>Payouts to Bridget</span><span className="status">{settings?.stripe_payouts_enabled ? "Active" : "Not active"}</span></li>
            <li><span>Server integration</span><span className="status">{stripeServerConfigured() ? "Configured" : "Credential needed"}</span></li>
            <li><span>Webhook reconciliation</span><span className="status">{stripeWebhookConfigured() ? "Configured" : "Secret needed"}</span></li>
          </ul>
          {settings?.stripe_requirements_currently_due?.length ? (
            <p className="mini-meta" style={{ marginTop: 14 }}>
              Stripe still requires {settings.stripe_requirements_currently_due.length} onboarding item(s). Continue Stripe setup to complete them.
            </p>
          ) : null}
          {settings?.stripe_connect_provisioning_error ? (
            <p className="form-error" role="alert">{settings.stripe_connect_provisioning_error}</p>
          ) : null}
          <div style={{ maxWidth: 360, marginTop: 16 }}>
            <StripeConnectSetupButton ready={stripeReady} />
          </div>
        </section>

        <section className="panel span-2">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Flexible Billing</span>
              <h2>Offline payments remain available</h2>
            </div>
          </div>
          <p>
            Stripe is an additional payment option. You can still accept check, bank transfer, cash,
            or another offline method and record the payment manually on the invoice.
          </p>
          <ul className="list" style={{ marginTop: 16 }}>
            <li>
              <span>Send invoice</span>
              <span className="status">Client receives email + PDF</span>
            </li>
            <li>
              <span>Collect payment</span>
              <span className="status">Stripe or offline</span>
            </li>
            <li>
              <span>Reconcile balance</span>
              <span className="status">Automatic for Stripe · manual for offline</span>
            </li>
          </ul>
          <div className="topbar-actions" style={{ marginTop: 16 }}>
            <ButtonLink href="/admin/invoices" variant="light">Open invoices</ButtonLink>
            <ButtonLink href="/admin/payments" variant="secondary">Payment records</ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}

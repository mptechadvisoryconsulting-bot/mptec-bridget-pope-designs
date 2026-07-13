import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { mapEmailReadinessStatus, redactEmailError } from "@/lib/email/delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile } = await getCurrentProfile();
  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select(
      "business_email,business_display_name,inquiry_recipient_email,invoice_from_display_name,invoice_reply_to,owner_message_notification_email,client_email_notifications_enabled,inquiry_notifications_enabled,invoice_notifications_enabled,payment_confirmation_notifications_enabled,stripe_connected_account_id,stripe_payment_model,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,stripe_account_last_synced_at,email_readiness_status,email_provider_last_success_at,email_provider_last_message_id,email_provider_last_failure_at,email_provider_last_error,email_last_test_sent_at,email_last_error,platform_fee_basis_points",
    )
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
        currentRole={profile?.role ?? "admin"}
        emailReadiness={{
          status: mapEmailReadinessStatus(settings?.email_readiness_status, settings?.email_provider_last_error ?? settings?.email_last_error),
          lastSuccessAt: settings?.email_provider_last_success_at ?? null,
          lastMessageId: settings?.email_provider_last_message_id ?? null,
          lastFailureAt: settings?.email_provider_last_failure_at ?? null,
          lastErrorSafe: redactEmailError(settings?.email_provider_last_error ?? settings?.email_last_error),
          lastTestSentAt: settings?.email_last_test_sent_at ?? null,
        }}
        ownerEmailSettings={{
          businessDisplayName: settings?.business_display_name ?? "Bridget Pope Designs",
          inquiryRecipientEmail: settings?.inquiry_recipient_email ?? settings?.business_email ?? process.env.OWNER_EMAIL ?? "",
          invoiceFromDisplayName: settings?.invoice_from_display_name ?? "Bridget Pope Designs",
          invoiceReplyTo: settings?.invoice_reply_to ?? "",
          ownerMessageNotificationEmail: settings?.owner_message_notification_email ?? "",
          clientEmailNotificationsEnabled: settings?.client_email_notifications_enabled ?? true,
          inquiryNotificationsEnabled: settings?.inquiry_notifications_enabled ?? true,
          invoiceNotificationsEnabled: settings?.invoice_notifications_enabled ?? true,
          paymentConfirmationNotificationsEnabled: settings?.payment_confirmation_notifications_enabled ?? true,
        }}
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

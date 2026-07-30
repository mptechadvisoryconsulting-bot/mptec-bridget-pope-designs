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
      "business_email,business_display_name,inquiry_recipient_email,invoice_from_display_name,invoice_reply_to,owner_message_notification_email,client_email_notifications_enabled,inquiry_notifications_enabled,invoice_notifications_enabled,payment_confirmation_notifications_enabled,payment_reminders_enabled,show_inventory_nav,show_team_nav,show_contracts_nav,cash_app_handle,zelle_handle,venmo_handle,bank_transfer_notes,check_payable_to,payment_instructions_notes,email_readiness_status,email_provider_last_success_at,email_provider_last_message_id,email_provider_last_failure_at,email_provider_last_error,email_last_test_sent_at,email_last_error",
    )
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Business Settings</span>
          <h1>Settings</h1>
          <p className="mini-meta">Email, offline payment instructions, reminders, and dashboard menu options.</p>
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
          paymentRemindersEnabled: settings?.payment_reminders_enabled ?? false,
          showInventoryNav: settings?.show_inventory_nav ?? false,
          showTeamNav: settings?.show_team_nav ?? false,
          showContractsNav: settings?.show_contracts_nav !== false,
          cashAppHandle: settings?.cash_app_handle ?? "",
          zelleHandle: settings?.zelle_handle ?? "",
          venmoHandle: settings?.venmo_handle ?? "",
          bankTransferNotes: settings?.bank_transfer_notes ?? "",
          checkPayableTo: settings?.check_payable_to ?? "",
          paymentInstructionsNotes: settings?.payment_instructions_notes ?? "",
        }}
      />
    </div>
  );
}

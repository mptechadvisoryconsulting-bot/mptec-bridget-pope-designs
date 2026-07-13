import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { mapEmailReadinessStatus, redactEmailError } from "@/lib/email/delivery";
import { createAdminClient } from "@/lib/supabase/admin";

const emailOrEmpty = z.union([z.string().trim().email(), z.literal("")]);

/**
 * All fields are optional so the owner can update any subset of business_settings without the
 * route overwriting untouched columns (e.g. forcing notification toggles back to true).
 */
const settingsSchema = z
  .object({
    businessDisplayName: z.string().trim().min(1).max(200),
    inquiryRecipientEmail: emailOrEmpty,
    invoiceFromDisplayName: z.string().trim().min(1).max(200),
    invoiceReplyTo: emailOrEmpty,
    ownerMessageNotificationEmail: emailOrEmpty,
    clientEmailNotificationsEnabled: z.boolean(),
    inquiryNotificationsEnabled: z.boolean(),
    invoiceNotificationsEnabled: z.boolean(),
    paymentConfirmationNotificationsEnabled: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "No settings were provided." });

const columnSelect =
  "id,business_email,business_display_name,inquiry_recipient_email,invoice_from_display_name,invoice_reply_to,owner_message_notification_email,client_email_notifications_enabled,inquiry_notifications_enabled,invoice_notifications_enabled,payment_confirmation_notifications_enabled,email_readiness_status,email_provider_last_success_at,email_provider_last_message_id,email_provider_last_failure_at,email_provider_last_error,email_last_test_sent_at,email_last_error";

function toSettingsPayload(input: z.infer<typeof settingsSchema>) {
  const payload: Record<string, unknown> = {};

  if (input.businessDisplayName !== undefined) payload.business_display_name = input.businessDisplayName;
  if (input.inquiryRecipientEmail !== undefined) payload.inquiry_recipient_email = input.inquiryRecipientEmail || null;
  if (input.invoiceFromDisplayName !== undefined) payload.invoice_from_display_name = input.invoiceFromDisplayName;
  if (input.invoiceReplyTo !== undefined) payload.invoice_reply_to = input.invoiceReplyTo || null;
  if (input.ownerMessageNotificationEmail !== undefined) {
    payload.owner_message_notification_email = input.ownerMessageNotificationEmail || null;
  }
  if (input.clientEmailNotificationsEnabled !== undefined) {
    payload.client_email_notifications_enabled = input.clientEmailNotificationsEnabled;
  }
  if (input.inquiryNotificationsEnabled !== undefined) {
    payload.inquiry_notifications_enabled = input.inquiryNotificationsEnabled;
  }
  if (input.invoiceNotificationsEnabled !== undefined) {
    payload.invoice_notifications_enabled = input.invoiceNotificationsEnabled;
  }
  if (input.paymentConfirmationNotificationsEnabled !== undefined) {
    payload.payment_confirmation_notifications_enabled = input.paymentConfirmationNotificationsEnabled;
  }

  // Sending will always fail without a recipient, so reflect that immediately rather than
  // waiting for the next send attempt to flip readiness away from a stale "ready" state.
  if (payload.inquiry_recipient_email === null) {
    payload.email_readiness_status = "not_configured";
  }

  return payload;
}

function toResponseShape(row: Record<string, any> | null | undefined) {
  if (!row) return null;

  return {
    businessDisplayName: row.business_display_name ?? null,
    inquiryRecipientEmail: row.inquiry_recipient_email ?? null,
    invoiceFromDisplayName: row.invoice_from_display_name ?? null,
    invoiceReplyTo: row.invoice_reply_to ?? null,
    ownerMessageNotificationEmail: row.owner_message_notification_email ?? null,
    clientEmailNotificationsEnabled: Boolean(row.client_email_notifications_enabled),
    inquiryNotificationsEnabled: Boolean(row.inquiry_notifications_enabled),
    invoiceNotificationsEnabled: Boolean(row.invoice_notifications_enabled),
    paymentConfirmationNotificationsEnabled: Boolean(row.payment_confirmation_notifications_enabled),
    emailReadinessStatus: mapEmailReadinessStatus(row.email_readiness_status, row.email_provider_last_error ?? row.email_last_error),
    emailProviderLastSuccessAt: row.email_provider_last_success_at ?? null,
    emailProviderLastMessageId: row.email_provider_last_message_id ?? null,
    emailProviderLastFailureAt: row.email_provider_last_failure_at ?? null,
    emailLastErrorSafe: redactEmailError(row.email_provider_last_error ?? row.email_last_error),
    emailLastTestSentAt: row.email_last_test_sent_at ?? null,
  };
}

export async function GET() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const supabase = createAdminClient();
  const { data: settings, error } = await supabase.from("business_settings").select(columnSelect).limit(1).maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, settings: toResponseShape(settings) });
}

export async function PUT(request: Request) {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  let input: z.infer<typeof settingsSchema>;
  try {
    input = settingsSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid settings payload." : "Invalid settings payload.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("business_settings").select("id").limit(1).maybeSingle();
  const payload = toSettingsPayload(input);

  const { data: saved, error } = existing?.id
    ? await supabase.from("business_settings").update(payload).eq("id", existing.id).select(columnSelect).maybeSingle()
    : await supabase.from("business_settings").insert(payload).select(columnSelect).maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  await supabase.from("activity_logs").insert({
    actor_id: owner.profile.id,
    action: "business_email_settings_updated",
    entity_type: "business_settings",
    entity_id: existing?.id ?? saved?.id ?? null,
    metadata: { updated_fields: Object.keys(payload) },
  });

  return NextResponse.json({ success: true, settings: toResponseShape(saved) });
}

import { NextResponse } from "next/server";
import { recalculateInvoiceFinancials, recalculatePaymentRefundState } from "@/lib/billing/invoice-reconciliation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeWebhookSignature } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STALE_EVENT_CLAIM_MS = 5 * 60 * 1000;

function centsToMoney(value: unknown) {
  const cents = Number(value ?? 0);
  return Number((cents / 100).toFixed(2));
}

function objectId(object: any) {
  return typeof object?.id === "string" ? object.id : null;
}

async function markEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  status: "processed" | "ignored" | "failed",
  processingError?: string | null,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("stripe_events")
    .update({
      processing_status: status,
      processing_error: processingError ? processingError.slice(0, 1000) : null,
      processed_at: status === "failed" ? null : now,
      failed_at: status === "failed" ? now : null,
    })
    .eq("stripe_event_id", eventId);
  if (error) throw new Error(error.message);
}

async function registerEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: any,
  eventAccountId: string | null,
  stripeObject: any,
) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_account_id: eventAccountId,
    object_id: objectId(stripeObject),
    processing_status: "claimed",
    claimed_at: now,
    processing_started_at: now,
  });

  if (!error) return { process: true as const };
  if (error.code !== "23505") throw new Error(error.message);

  const { data: existing, error: lookupError } = await supabase
    .from("stripe_events")
    .select("processing_status,retry_count,processing_started_at")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (existing?.processing_status === "processed" || existing?.processing_status === "ignored") {
    return { process: false as const };
  }

  const existingStartedAt = existing?.processing_started_at ? new Date(existing.processing_started_at).getTime() : 0;
  const isStaleClaim =
    existing?.processing_status === "claimed" &&
    (!existingStartedAt || Date.now() - existingStartedAt >= STALE_EVENT_CLAIM_MS);
  const isFailed = existing?.processing_status === "failed";

  if (!isFailed && !isStaleClaim) {
    return { process: false as const };
  }

  let claim = supabase
    .from("stripe_events")
    .update({
      processing_status: "claimed",
      processing_started_at: now,
      claimed_at: now,
      processing_error: null,
      failed_at: null,
      retry_count: Number(existing?.retry_count ?? 0) + 1,
    })
    .eq("stripe_event_id", event.id)
    .eq("processing_status", String(existing?.processing_status ?? ""));

  claim = existing?.processing_started_at
    ? claim.eq("processing_started_at", existing.processing_started_at)
    : claim.is("processing_started_at", null);

  const { data: reclaimed, error: retryError } = await claim.select("stripe_event_id").maybeSingle();
  if (retryError) throw new Error(retryError.message);
  return { process: Boolean(reclaimed?.stripe_event_id) as boolean } as { process: boolean };
}

async function reconcilePaidCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  event: any,
  session: any,
  connectedAccountId: string,
) {
  if (session?.payment_status !== "paid") return;

  const invoiceId = session?.metadata?.invoice_id;
  const projectId = session?.metadata?.project_id;
  const clientId = session?.metadata?.client_id;
  if (!invoiceId || !projectId || !clientId) throw new Error("Stripe checkout metadata is incomplete.");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,project_id,client_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.project_id !== projectId || invoice.client_id !== clientId) {
    throw new Error("Stripe checkout does not match the local invoice.");
  }

  const grossAmount = centsToMoney(session.amount_total);
  const platformFeeAmount = centsToMoney(session?.metadata?.platform_fee_cents);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    project_id: projectId,
    client_id: clientId,
    stripe_customer_id: customerId ?? null,
    stripe_event_id: event.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId ?? null,
    stripe_connected_account_id: connectedAccountId,
    amount: grossAmount,
    gross_amount: grossAmount,
    platform_fee_amount: platformFeeAmount,
    net_amount: null,
    currency: String(session.currency ?? "usd").toLowerCase(),
    payment_type: "invoice_payment",
    payment_method: "stripe",
    payment_model: "direct_charge_v2",
    stripe_account_context: connectedAccountId,
    status: "paid",
    paid_at: new Date().toISOString(),
    refunded_amount: 0,
    metadata: {
      note: "Paid securely through Stripe",
      checkout_session_id: session.id,
      platform_fee_basis_points: Number(session?.metadata?.platform_fee_basis_points ?? 0),
      net_amount_note: "Stripe processing fees are assessed on the connected account and are not estimated here.",
    },
  });

  if (paymentError?.code === "23505") {
    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from("payments")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (existingPaymentError || !existingPayment?.id) {
      throw new Error(existingPaymentError?.message ?? paymentError.message);
    }
  } else if (paymentError) {
    throw new Error(paymentError.message);
  }

  await recalculateInvoiceFinancials(supabase, invoiceId);
  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id, checkout_status: "paid", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);

  const { data: settings } = await supabase
    .from("business_settings")
    .select("payment_confirmation_notifications_enabled")
    .limit(1)
    .maybeSingle();

  if (settings?.payment_confirmation_notifications_enabled !== false) {
    const { data: admins } = await supabase.from("profiles").select("id").in("role", ["owner", "admin"]).eq("active", true);
    if (admins?.length) {
      const { error: notificationError } = await supabase.from("notifications").insert(
        admins.map((admin) => ({
          recipient_id: admin.id,
          project_id: projectId,
          type: "payment_received",
          title: "Stripe payment received",
          message: `A Stripe payment was recorded for invoice ${invoiceId}.`,
          action_url: `/admin/invoices/${invoiceId}`,
        })),
      );
      if (notificationError) console.warn("Unable to create Stripe payment notification", { message: notificationError.message });
    }
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    project_id: projectId,
    action: "stripe_invoice_payment_recorded",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: { checkout_session_id: session.id, stripe_event_id: event.id, payment_model: "direct_charge_v2" },
  });
  if (activityError) console.warn("Unable to write Stripe payment activity log", { message: activityError.message });
}

async function reconcileRefund(
  supabase: ReturnType<typeof createAdminClient>,
  event: any,
  charge: any,
) {
  const paymentIntentId = typeof charge?.payment_intent === "string" ? charge.payment_intent : charge?.payment_intent?.id;
  if (!paymentIntentId || Number(charge?.amount_refunded ?? 0) <= 0) return;

  const { data: payment } = await supabase
    .from("payments")
    .select("id,invoice_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!payment?.id || !payment.invoice_id) return;

  const refundedAmount = centsToMoney(charge.amount_refunded);
  const adjustmentPayload = {
    payment_id: payment.id,
    invoice_id: payment.invoice_id,
    adjustment_type: "refund",
    amount: refundedAmount,
    status: "succeeded",
    stripe_event_id: event.id,
    stripe_refund_id: null,
    metadata: {
      charge_id: charge.id,
      payment_intent_id: paymentIntentId,
      source: "stripe_cumulative_amount_refunded",
    },
    updated_at: new Date().toISOString(),
  };

  const { data: existingAdjustment, error: adjustmentLookupError } = await supabase
    .from("payment_adjustments")
    .select("id")
    .eq("payment_id", payment.id)
    .eq("adjustment_type", "refund")
    .maybeSingle();
  if (adjustmentLookupError) throw new Error(adjustmentLookupError.message);

  if (existingAdjustment?.id) {
    const { error: adjustmentUpdateError } = await supabase
      .from("payment_adjustments")
      .update(adjustmentPayload)
      .eq("id", existingAdjustment.id);
    if (adjustmentUpdateError) throw new Error(adjustmentUpdateError.message);
  } else {
    const { error: adjustmentInsertError } = await supabase.from("payment_adjustments").insert(adjustmentPayload);
    if (adjustmentInsertError?.code === "23505") {
      const { error: retryUpdateError } = await supabase
        .from("payment_adjustments")
        .update(adjustmentPayload)
        .eq("payment_id", payment.id)
        .eq("adjustment_type", "refund");
      if (retryUpdateError) throw new Error(retryUpdateError.message);
    } else if (adjustmentInsertError) {
      throw new Error(adjustmentInsertError.message);
    }
  }

  await recalculatePaymentRefundState(supabase, payment.id);
  await recalculateInvoiceFinancials(supabase, payment.invoice_id);
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyStripeWebhookSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ success: false, message: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ success: false, message: "Invalid Stripe event payload." }, { status: 400 });
  }

  if (!event?.id || !event?.type) {
    return NextResponse.json({ success: false, message: "Invalid Stripe event." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const eventAccountId = typeof event.account === "string" ? event.account : null;
  const stripeObject = event?.data?.object;

  try {
    const registration = await registerEvent(supabase, event, eventAccountId, stripeObject);
    if (!registration.process) {
      return NextResponse.json({ success: true, duplicate: true });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Unable to register Stripe event." }, { status: 500 });
  }

  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("stripe_connected_account_id,stripe_payment_model")
      .limit(1)
      .maybeSingle();

    if (
      !settings?.stripe_connected_account_id ||
      settings.stripe_payment_model !== "direct_charge_v2" ||
      eventAccountId !== settings.stripe_connected_account_id
    ) {
      await markEvent(supabase, event.id, "ignored");
      return NextResponse.json({ success: true, ignored: true });
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await reconcilePaidCheckout(supabase, event, stripeObject, settings.stripe_connected_account_id);
    } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
      const invoiceId = stripeObject?.metadata?.invoice_id;
      if (invoiceId) {
        const { error: checkoutUpdateError } = await supabase
          .from("invoices")
          .update({ checkout_status: event.type.endsWith("expired") ? "expired" : "failed", updated_at: new Date().toISOString() })
          .eq("id", invoiceId)
          .eq("stripe_checkout_session_id", stripeObject?.id);
        if (checkoutUpdateError) throw new Error(checkoutUpdateError.message);
      }
    } else if (event.type === "charge.refunded") {
      await reconcileRefund(supabase, event, stripeObject);
    }

    await markEvent(supabase, event.id, "processed");
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe event processing failed.";
    try {
      await markEvent(supabase, event.id, "failed", message);
    } catch (markError) {
      console.error("Unable to persist Stripe webhook failure state", {
        eventId: event.id,
        error: markError instanceof Error ? markError.message : String(markError),
      });
    }
    return NextResponse.json({ success: false, message: "Stripe event processing failed." }, { status: 500 });
  }
}

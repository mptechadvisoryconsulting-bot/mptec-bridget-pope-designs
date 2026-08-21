import { NextResponse } from "next/server";
import { recalculateInvoiceFinancials, recalculatePaymentRefundState } from "@/lib/billing/invoice-reconciliation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeWebhookSignature } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  await supabase
    .from("stripe_events")
    .update({
      status,
      processing_error: processingError ? processingError.slice(0, 1000) : null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);
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

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (!existing?.id) {
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
      net_amount: Number((grossAmount - platformFeeAmount).toFixed(2)),
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
      },
    });
    if (paymentError) throw new Error(paymentError.message);
  }

  await recalculateInvoiceFinancials(supabase, invoiceId);
  await supabase
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id, checkout_status: "paid", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  const { data: settings } = await supabase
    .from("business_settings")
    .select("payment_confirmation_notifications_enabled")
    .limit(1)
    .maybeSingle();

  if (settings?.payment_confirmation_notifications_enabled !== false) {
    const { data: admins } = await supabase.from("profiles").select("id").in("role", ["owner", "admin"]).eq("active", true);
    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map((admin) => ({
          recipient_id: admin.id,
          project_id: projectId,
          type: "payment_received",
          title: "Stripe payment received",
          message: `A Stripe payment was recorded for invoice ${invoiceId}.`,
          action_url: `/admin/invoices/${invoiceId}`,
        })),
      );
    }
  }

  await supabase.from("activity_logs").insert({
    project_id: projectId,
    action: "stripe_invoice_payment_recorded",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: { checkout_session_id: session.id, stripe_event_id: event.id, payment_model: "direct_charge_v2" },
  });
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
  const { error: adjustmentError } = await supabase.from("payment_adjustments").upsert(
    {
      payment_id: payment.id,
      invoice_id: payment.invoice_id,
      adjustment_type: "refund",
      amount: refundedAmount,
      status: "succeeded",
      stripe_event_id: event.id,
      stripe_refund_id: null,
      metadata: { charge_id: charge.id, payment_intent_id: paymentIntentId },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_event_id" },
  );
  if (adjustmentError) throw new Error(adjustmentError.message);

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
  const { error: eventInsertError } = await supabase.from("stripe_events").insert({
    id: event.id,
    event_type: event.type,
    stripe_account_id: eventAccountId,
    object_id: objectId(stripeObject),
    status: "processing",
  });

  if (eventInsertError?.code === "23505") {
    return NextResponse.json({ success: true, duplicate: true });
  }
  if (eventInsertError) {
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
        await supabase
          .from("invoices")
          .update({ checkout_status: event.type.endsWith("expired") ? "expired" : "failed", updated_at: new Date().toISOString() })
          .eq("id", invoiceId)
          .eq("stripe_checkout_session_id", stripeObject?.id);
      }
    } else if (event.type === "charge.refunded") {
      await reconcileRefund(supabase, event, stripeObject);
    }

    await markEvent(supabase, event.id, "processed");
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe event processing failed.";
    await markEvent(supabase, event.id, "failed", message);
    return NextResponse.json({ success: false, message: "Stripe event processing failed." }, { status: 500 });
  }
}

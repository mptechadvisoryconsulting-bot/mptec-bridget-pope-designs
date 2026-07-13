import type Stripe from "stripe";
import { fromCents, toCents } from "@/lib/billing/invoice-calculations";
import { recalculateInvoiceFinancials, recalculatePaymentRefundState } from "@/lib/billing/invoice-reconciliation";
import { refundPlatformFeePolicy } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { DESTINATION_CHARGE_V1, DIRECT_CHARGE_V2, normalizePaymentModel, syncStripeConnectAccount } from "@/lib/stripe/connect";
import { claimStripeEvent, completeStripeEvent, duplicateError, failStripeEvent, notifyAdmins } from "@/lib/stripe/webhook-events";

export const runtime = "nodejs";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function dollars(cents?: number | null) {
  return fromCents(cents ?? 0);
}

async function invoiceById(supabase: SupabaseAdmin, invoiceId?: string | null) {
  if (!invoiceId) return null;
  const { data } = await supabase
    .from("invoices")
    .select("id,total,amount_paid,balance_due,project_id,client_id,status")
    .eq("id", invoiceId)
    .maybeSingle();
  return data;
}

async function trustedPaymentSettings(supabase: SupabaseAdmin) {
  const { data, error } = await supabase
    .from("business_settings")
    .select("stripe_connected_account_id,stripe_payment_model")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function retrievePaymentIntentWithCharge(paymentIntentId: string, paymentModel: string, connectedAccountId?: string | null) {
  if (paymentModel === DIRECT_CHARGE_V2) {
    if (!connectedAccountId) throw new Error("Direct-charge payment is missing connected account context.");
    return getStripe().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge", "latest_charge.balance_transaction"] },
      { stripeAccount: connectedAccountId },
    );
  }

  try {
    return await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge", "latest_charge.balance_transaction"],
    });
  } catch (error) {
    if (!connectedAccountId) throw error;
    return getStripe().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge", "latest_charge.balance_transaction"] },
      { stripeAccount: connectedAccountId },
    );
  }
}

async function recordPaidCheckout(supabase: SupabaseAdmin, event: Stripe.Event, session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoice_id;
  const invoice = await invoiceById(supabase, invoiceId);
  const projectId = session.metadata?.project_id;
  const clientId = session.metadata?.client_id;
  const paymentAttemptId = session.metadata?.payment_attempt_id;
  const paymentModel = normalizePaymentModel(session.metadata?.payment_model);
  const stripeAccountContext = session.metadata?.stripe_account_context ?? session.metadata?.stripe_account_id ?? event.account ?? null;
  const amountCents = session.amount_total ?? 0;
  const amount = dollars(amountCents);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  if (session.payment_status !== "paid") {
    throw new Error(`Checkout session ${session.id} is not paid.`);
  }

  if (!invoiceId || !invoice) {
    throw new Error(`Checkout session ${session.id} is missing a matching invoice.`);
  }

  if (!projectId || projectId !== invoice.project_id) {
    throw new Error(`Checkout session ${session.id} project metadata does not match invoice.`);
  }

  if (!clientId || clientId !== invoice.client_id) {
    throw new Error(`Checkout session ${session.id} client metadata does not match invoice.`);
  }

  if (!paymentIntentId) {
    throw new Error(`Checkout session ${session.id} is missing a PaymentIntent.`);
  }

  if (amountCents <= 0) {
    throw new Error(`Checkout session ${session.id} has invalid amount.`);
  }

  if ((session.currency ?? "usd").toLowerCase() !== "usd") {
    throw new Error(`Checkout session ${session.id} has unsupported currency.`);
  }

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existingPayment) return;

  if (amountCents > toCents(Number(invoice.balance_due ?? invoice.total ?? 0))) {
    throw new Error(`Checkout session ${session.id} exceeds trusted invoice balance.`);
  }

  const settings = await trustedPaymentSettings(supabase);
  if (!settings?.stripe_connected_account_id || stripeAccountContext !== settings.stripe_connected_account_id) {
    throw new Error(`Checkout session ${session.id} connected account metadata does not match trusted settings.`);
  }

  if (![DESTINATION_CHARGE_V1, DIRECT_CHARGE_V2].includes(paymentModel)) {
    throw new Error(`Checkout session ${session.id} has unsupported payment model.`);
  }

  if (paymentModel === DIRECT_CHARGE_V2 && event.account !== stripeAccountContext) {
    throw new Error(`Checkout session ${session.id} direct-charge event account does not match the stored connected account context.`);
  }

  let charge: Stripe.Charge | null = null;
  let balanceTransaction: Stripe.BalanceTransaction | null = null;
  if (paymentIntentId) {
    const paymentIntent = await retrievePaymentIntentWithCharge(paymentIntentId, paymentModel, stripeAccountContext);

    charge = typeof paymentIntent.latest_charge === "object" && paymentIntent.latest_charge ? paymentIntent.latest_charge : null;
    balanceTransaction =
      typeof charge?.balance_transaction === "object" && charge.balance_transaction ? charge.balance_transaction : null;
  }

  const applicationFee =
    typeof charge?.application_fee === "string"
      ? charge.application_fee
      : typeof charge?.application_fee === "object" && charge.application_fee
        ? charge.application_fee.id
        : null;
  const platformFeeCents = Number(session.metadata?.platform_fee_amount_cents ?? 0);

  const { error: paymentInsertError } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    project_id: projectId,
    client_id: clientId,
    stripe_event_id: event.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_connected_account_id: stripeAccountContext,
    payment_model: paymentModel,
    stripe_account_context: stripeAccountContext,
    stripe_charge_id: charge?.id ?? null,
    stripe_application_fee_id: applicationFee,
    stripe_balance_transaction_id:
      typeof charge?.balance_transaction === "string" ? charge.balance_transaction : balanceTransaction?.id ?? null,
    amount,
    gross_amount: amount,
    platform_fee_amount: dollars(platformFeeCents),
    stripe_processing_fee: balanceTransaction ? dollars(balanceTransaction.fee) : null,
    net_amount: balanceTransaction ? dollars(balanceTransaction.net) : null,
    currency: session.currency ?? "usd",
    payment_type: session.metadata?.payment_type ?? "invoice",
    status: "paid",
    paid_at: new Date().toISOString(),
    metadata: {
      payment_model: paymentModel,
      platform_fee_basis_points: session.metadata?.platform_fee_basis_points,
      gross_amount_cents: session.metadata?.gross_amount_cents,
      platform_fee_amount_cents: session.metadata?.platform_fee_amount_cents,
      checkout_session_id: session.id,
      payment_intent_id: paymentIntentId,
      charge_id: charge?.id ?? null,
      balance_transaction_id: balanceTransaction?.id ?? null,
    },
  });

  if (paymentInsertError) throw new Error(paymentInsertError.message);

  if (paymentAttemptId) {
    const { error: attemptUpdateError } = await supabase
      .from("payment_attempts")
      .update({
        status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        payment_model: paymentModel,
        stripe_account_context: stripeAccountContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentAttemptId);

    if (attemptUpdateError) throw new Error(attemptUpdateError.message);
  }

  await recalculateInvoiceFinancials(supabase, invoiceId);
  const { error: projectUpdateError } = await supabase.from("projects").update({ status: "booked" }).eq("id", projectId).eq("status", "pending");
  if (projectUpdateError) throw new Error(projectUpdateError.message);
}

async function recordFailedPaymentAttempt(
  supabase: SupabaseAdmin,
  event: Stripe.Event,
  input: {
    invoiceId?: string | null;
    projectId?: string | null;
    clientId?: string | null;
    checkoutSessionId?: string | null;
    paymentIntentId?: string | null;
    amountCents?: number | null;
    currency?: string | null;
    failureMessage?: string | null;
    paymentModel?: string | null;
    stripeAccountContext?: string | null;
  },
) {
  const invoice = await invoiceById(supabase, input.invoiceId);
  const projectId = input.projectId ?? invoice?.project_id;
  const clientId = input.clientId ?? invoice?.client_id;

  if (!projectId) {
    await notifyAdmins(supabase, {
      type: "stripe_payment_failed_unmatched",
      title: "Failed payment could not be matched",
      message: `Stripe event ${event.id} did not include a matching project.`,
    });
    return;
  }

  const { error: attemptInsertError } = await supabase.from("payment_attempts").insert({
    invoice_id: input.invoiceId ?? null,
    project_id: projectId,
    client_id: clientId ?? null,
    payment_model: normalizePaymentModel(input.paymentModel),
    stripe_account_context: input.stripeAccountContext ?? null,
    stripe_event_id: event.id,
    stripe_checkout_session_id: input.checkoutSessionId ?? null,
    stripe_payment_intent_id: input.paymentIntentId ?? null,
    amount: dollars(input.amountCents),
    currency: input.currency ?? "usd",
    status: "failed",
    failure_message: input.failureMessage ?? null,
    metadata: {
      event_type: event.type,
      payment_type: "invoice",
      payment_model: normalizePaymentModel(input.paymentModel),
      stripe_account_context: input.stripeAccountContext ?? null,
    },
  });
  if (attemptInsertError && !duplicateError(attemptInsertError)) throw new Error(attemptInsertError.message);

  if (input.invoiceId) {
    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({
        checkout_status: "payment_failed",
        last_payment_attempt_at: new Date().toISOString(),
        last_payment_failure_message: input.failureMessage ?? "Stripe payment attempt failed.",
      })
      .eq("id", input.invoiceId);
    if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);
  }

  await notifyAdmins(supabase, {
    type: "payment_failed",
    title: "Payment attempt failed",
    message: input.failureMessage ?? "A client payment attempt failed in Stripe.",
    projectId,
    actionUrl: `/admin/payments`,
  });
}

async function handleRefundCreated(supabase: SupabaseAdmin, event: Stripe.Event, refund: Stripe.Refund) {
  const { data: existingAdjustment } = await supabase
    .from("payment_adjustments")
    .select("id")
    .eq("stripe_refund_id", refund.id)
    .maybeSingle();

  if (existingAdjustment) return;

  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: payment } = await supabase
    .from("payments")
    .select("id,invoice_id,project_id,client_id,refunded_amount,status,payment_model,stripe_account_context")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .in("status", ["paid", "partially_refunded", "refunded", "refund_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) return;

  const refundAmount = dollars(refund.amount);
  const { error: adjustmentInsertError } = await supabase.from("payment_adjustments").insert({
    payment_id: payment.id,
    invoice_id: payment.invoice_id,
    project_id: payment.project_id,
    client_id: payment.client_id ?? null,
    stripe_event_id: event.id,
    stripe_refund_id: refund.id,
    adjustment_type: "refund",
    amount: refundAmount,
    currency: refund.currency ?? "usd",
    status: refund.status ?? "created",
    metadata: {
      payment_intent_id: paymentIntentId,
      reason: refund.reason,
      payment_model: payment.payment_model,
      stripe_account_context: payment.stripe_account_context,
      refund_platform_fee_policy: refundPlatformFeePolicy(),
    },
  });
  if (adjustmentInsertError) throw new Error(adjustmentInsertError.message);

  await recalculatePaymentRefundState(supabase, payment.id);
  if (payment.invoice_id) await recalculateInvoiceFinancials(supabase, payment.invoice_id);

  await notifyAdmins(supabase, {
    type: "refund_created",
    title: "Stripe refund created",
    message: `A refund for ${dollars(refund.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })} was created.`,
    projectId: payment.project_id,
    actionUrl: "/admin/payments",
  });
}

async function handleDisputeCreated(supabase: SupabaseAdmin, event: Stripe.Event, dispute: Stripe.Dispute) {
  const { data: existingAdjustment } = await supabase
    .from("payment_adjustments")
    .select("id")
    .eq("stripe_dispute_id", dispute.id)
    .maybeSingle();

  if (existingAdjustment) return;

  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  let projectId = dispute.metadata?.project_id ?? null;
  let paymentId: string | null = null;
  let invoiceId: string | null = null;
  let clientId: string | null = null;

  if (paymentIntentId) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id,invoice_id,project_id,client_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    projectId = projectId ?? payment?.project_id ?? null;
    paymentId = payment?.id ?? null;
    invoiceId = payment?.invoice_id ?? null;
    clientId = payment?.client_id ?? null;
    if (payment?.id) {
      const { error: paymentUpdateError } = await supabase.from("payments").update({ status: "disputed" }).eq("id", payment.id);
      if (paymentUpdateError) throw new Error(paymentUpdateError.message);
    }
  }

  const { error: disputeInsertError } = await supabase.from("payment_adjustments").insert({
    payment_id: paymentId,
    invoice_id: invoiceId,
    project_id: projectId,
    client_id: clientId,
    stripe_event_id: event.id,
    stripe_dispute_id: dispute.id,
    adjustment_type: "dispute",
    amount: dollars(dispute.amount),
    currency: dispute.currency ?? "usd",
    status: dispute.status,
    metadata: {
      payment_intent_id: paymentIntentId,
      reason: dispute.reason,
    },
  });
  if (disputeInsertError) throw new Error(disputeInsertError.message);

  await notifyAdmins(supabase, {
    type: "stripe_dispute_created",
    title: "Stripe dispute opened",
    message: `A dispute was opened for ${dollars(dispute.amount).toLocaleString("en-US", { style: "currency", currency: dispute.currency?.toUpperCase() ?? "USD" })}.`,
    projectId,
    actionUrl: "/admin/payments",
  });
}

async function handlePayoutFailed(supabase: SupabaseAdmin, event: Stripe.Event, payout: Stripe.Payout) {
  const { data: existingAdjustment } = await supabase
    .from("payment_adjustments")
    .select("id")
    .eq("stripe_payout_id", payout.id)
    .eq("adjustment_type", "payout_failure")
    .maybeSingle();

  if (!existingAdjustment) {
    const { error: payoutInsertError } = await supabase.from("payment_adjustments").insert({
      stripe_event_id: event.id,
      stripe_payout_id: payout.id,
      adjustment_type: "payout_failure",
      amount: dollars(payout.amount),
      currency: payout.currency ?? "usd",
      status: payout.status,
      metadata: {
        failure_code: payout.failure_code,
        failure_message: payout.failure_message,
        arrival_date: payout.arrival_date,
      },
    });
    if (payoutInsertError) throw new Error(payoutInsertError.message);
  }

  if (event.account) {
    const { error: settingsUpdateError } = await supabase
      .from("business_settings")
      .update({
        payment_readiness_status: "payout_issue",
        stripe_payouts_enabled: false,
        stripe_account_last_synced_at: new Date().toISOString(),
      })
      .eq("stripe_connected_account_id", event.account);
    if (settingsUpdateError) throw new Error(settingsUpdateError.message);
  }

  await notifyAdmins(supabase, {
    type: "stripe_payout_failed",
    title: "Stripe payout failed",
    message: `Stripe payout ${payout.id} failed for ${dollars(payout.amount).toLocaleString("en-US", { style: "currency", currency: payout.currency?.toUpperCase() ?? "USD" })}.`,
    actionUrl: "/admin/settings/payments",
  });
}

async function syncAccountFromEvent(supabase: SupabaseAdmin, event: Stripe.Event) {
  const object = event.data.object as { id?: string; object?: string; account?: string };
  const accountId = event.account ?? (object.object === "account" ? object.id : object.account);

  if (accountId) {
    await syncStripeConnectAccount(supabase, accountId);
  }
}

async function handleStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await recordPaidCheckout(supabase, event, event.data.object as Stripe.Checkout.Session);
      return;
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordFailedPaymentAttempt(supabase, event, {
        invoiceId: session.metadata?.invoice_id,
        projectId: session.metadata?.project_id,
        clientId: session.metadata?.client_id,
        checkoutSessionId: session.id,
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        amountCents: session.amount_total,
        currency: session.currency,
        failureMessage: "A delayed Stripe payment failed.",
        paymentModel: session.metadata?.payment_model,
        stripeAccountContext: session.metadata?.stripe_account_context ?? session.metadata?.stripe_account_id ?? event.account,
      });
      return;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await recordFailedPaymentAttempt(supabase, event, {
        invoiceId: paymentIntent.metadata?.invoice_id,
        projectId: paymentIntent.metadata?.project_id,
        clientId: paymentIntent.metadata?.client_id,
        paymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount,
        currency: paymentIntent.currency,
        failureMessage: paymentIntent.last_payment_error?.message ?? "A Stripe payment failed.",
        paymentModel: paymentIntent.metadata?.payment_model,
        stripeAccountContext: paymentIntent.metadata?.stripe_account_context ?? paymentIntent.metadata?.stripe_account_id ?? event.account,
      });
      return;
    }
    case "account.updated":
    case "account.external_account.updated":
      await syncAccountFromEvent(supabase, event);
      return;
    case "payout.failed":
      await handlePayoutFailed(supabase, event, event.data.object as Stripe.Payout);
      return;
    case "charge.dispute.created":
      await handleDisputeCreated(supabase, event, event.data.object as Stripe.Dispute);
      return;
    case "refund.created":
      await handleRefundCreated(supabase, event, event.data.object as Stripe.Refund);
      return;
    default:
      await notifyAdmins(supabase, {
        type: "stripe_unhandled_event",
        title: "Unhandled Stripe event",
        message: `Stripe sent ${event.type}. The raw event was stored for reconciliation.`,
        actionUrl: "/admin/payments",
      });
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe webhook is not configured", { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    if (error instanceof Error && error.name === "ConfigurationError") {
      return new Response("Stripe is not configured", { status: 503 });
    }

    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();
  const claim = await claimStripeEvent(supabase, event);

  if (!claim.claimed) {
    return new Response(claim.processed ? "Already processed" : "Already claimed", { status: claim.processed ? 200 : 409 });
  }

  try {
    await handleStripeEvent(supabase, event);
    await completeStripeEvent(supabase, event);
  } catch (error) {
    await failStripeEvent(supabase, event, error);
    console.error("Stripe webhook processing failed", error);
    return new Response("Webhook processing failed", { status: 500 });
  }

  return new Response("Received", { status: 200 });
}

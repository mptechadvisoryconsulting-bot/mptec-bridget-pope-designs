import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { syncStripeConnectAccount } from "@/lib/stripe/connect";

export const runtime = "nodejs";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function dollars(cents?: number | null) {
  return Number(((cents ?? 0) / 100).toFixed(2));
}

function duplicateError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || Boolean(error?.message?.toLowerCase().includes("duplicate"));
}

async function claimStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event) {
  const { error } = await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    processing_started_at: new Date().toISOString(),
    payload: event,
  });

  if (!error) return { claimed: true as const };

  if (!duplicateError(error)) throw new Error(error.message);

  const { data: existing } = await supabase
    .from("stripe_events")
    .select("processed_at,processing_error")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  return {
    claimed: false as const,
    processed: Boolean(existing?.processed_at),
  };
}

async function completeStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event) {
  await supabase
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString(), processing_error: null, payload: event })
    .eq("stripe_event_id", event.id);
}

async function failStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook processing error";
  await supabase
    .from("stripe_events")
    .update({ processing_error: message, payload: event })
    .eq("stripe_event_id", event.id);
}

async function adminProfileIds(supabase: SupabaseAdmin) {
  const { data } = await supabase.from("profiles").select("id").in("role", ["owner", "admin"]).eq("active", true);
  return (data ?? []).map((profile) => profile.id);
}

async function notifyAdmins(supabase: SupabaseAdmin, input: { type: string; title: string; message: string; projectId?: string | null; actionUrl?: string }) {
  const recipients = await adminProfileIds(supabase);
  if (!recipients.length) return;

  await supabase.from("notifications").insert(
    recipients.map((recipientId) => ({
      recipient_id: recipientId,
      project_id: input.projectId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      action_url: input.actionUrl ?? "/admin/payments",
    })),
  );
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

async function recordPaidCheckout(supabase: SupabaseAdmin, event: Stripe.Event, session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoice_id;
  const invoice = await invoiceById(supabase, invoiceId);
  const projectId = session.metadata?.project_id ?? invoice?.project_id;
  const clientId = session.metadata?.client_id ?? invoice?.client_id;
  const amount = dollars(session.amount_total);

  if (!invoiceId || !projectId) return;

  await supabase.from("payments").insert({
    invoice_id: invoiceId,
    project_id: projectId,
    client_id: clientId ?? null,
    stripe_event_id: event.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    amount,
    currency: session.currency ?? "usd",
    payment_type: session.metadata?.payment_type ?? "invoice",
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  if (invoice) {
    const total = Number(invoice.total ?? 0);
    const paid = Math.min(total, Number(invoice.amount_paid ?? 0) + amount);
    const balance = Math.max(0, Number((total - paid).toFixed(2)));

    await supabase
      .from("invoices")
      .update({
        status: balance === 0 ? "paid" : "partially_paid",
        amount_paid: paid,
        balance_due: balance,
        checkout_status: "paid",
      })
      .eq("id", invoiceId);
  }

  await supabase.from("projects").update({ status: "booked" }).eq("id", projectId).eq("status", "pending");
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

  await supabase.from("payments").insert({
    invoice_id: input.invoiceId ?? null,
    project_id: projectId,
    client_id: clientId ?? null,
    stripe_event_id: event.id,
    stripe_checkout_session_id: input.checkoutSessionId ?? null,
    stripe_payment_intent_id: input.paymentIntentId ?? null,
    amount: dollars(input.amountCents),
    currency: input.currency ?? "usd",
    payment_type: "invoice",
    status: "failed",
  });

  if (input.invoiceId) {
    await supabase.from("invoices").update({ checkout_status: "payment_failed" }).eq("id", input.invoiceId);
  }

  await notifyAdmins(supabase, {
    type: "payment_failed",
    title: "Payment attempt failed",
    message: input.failureMessage ?? "A client payment attempt failed in Stripe.",
    projectId,
    actionUrl: `/admin/payments`,
  });
}

async function handleRefundCreated(supabase: SupabaseAdmin, refund: Stripe.Refund) {
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: payment } = await supabase
    .from("payments")
    .select("id,invoice_id,project_id,refunded_amount")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) return;

  const refundAmount = dollars(refund.amount);
  await supabase
    .from("payments")
    .update({
      refunded_amount: Number(payment.refunded_amount ?? 0) + refundAmount,
      status: refund.status === "succeeded" ? "refunded" : "refund_pending",
    })
    .eq("id", payment.id);

  const invoice = await invoiceById(supabase, payment.invoice_id);
  if (invoice) {
    const newPaid = Math.max(0, Number(invoice.amount_paid ?? 0) - refundAmount);
    const total = Number(invoice.total ?? 0);
    await supabase
      .from("invoices")
      .update({
        amount_paid: newPaid,
        balance_due: Math.max(0, Number((total - newPaid).toFixed(2))),
        status: newPaid <= 0 ? "refunded" : "partially_refunded",
      })
      .eq("id", invoice.id);
  }

  await notifyAdmins(supabase, {
    type: "refund_created",
    title: "Stripe refund created",
    message: `A refund for ${dollars(refund.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })} was created.`,
    projectId: payment.project_id,
    actionUrl: "/admin/payments",
  });
}

async function handleDisputeCreated(supabase: SupabaseAdmin, dispute: Stripe.Dispute) {
  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  let projectId = dispute.metadata?.project_id ?? null;

  if (paymentIntentId) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id,project_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    projectId = projectId ?? payment?.project_id ?? null;
    if (payment?.id) await supabase.from("payments").update({ status: "disputed" }).eq("id", payment.id);
  }

  await notifyAdmins(supabase, {
    type: "stripe_dispute_created",
    title: "Stripe dispute opened",
    message: `A dispute was opened for ${dollars(dispute.amount).toLocaleString("en-US", { style: "currency", currency: dispute.currency?.toUpperCase() ?? "USD" })}.`,
    projectId,
    actionUrl: "/admin/payments",
  });
}

async function handlePayoutFailed(supabase: SupabaseAdmin, payout: Stripe.Payout) {
  await notifyAdmins(supabase, {
    type: "stripe_payout_failed",
    title: "Stripe payout failed",
    message: `Stripe payout ${payout.id} failed for ${dollars(payout.amount).toLocaleString("en-US", { style: "currency", currency: payout.currency?.toUpperCase() ?? "USD" })}.`,
    actionUrl: "/admin/settings",
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
      });
      return;
    }
    case "account.updated":
    case "account.external_account.updated":
      await syncAccountFromEvent(supabase, event);
      return;
    case "payout.failed":
      await handlePayoutFailed(supabase, event.data.object as Stripe.Payout);
      return;
    case "charge.dispute.created":
      await handleDisputeCreated(supabase, event.data.object as Stripe.Dispute);
      return;
    case "refund.created":
      await handleRefundCreated(supabase, event.data.object as Stripe.Refund);
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

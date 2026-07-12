import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

const handledNoopEvents = new Set([
  "account.updated",
  "payout.failed",
  "account.external_account.updated",
  "charge.dispute.created",
  "refund.created",
]);

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: processedEvent } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (processedEvent) return new Response("Already processed", { status: 200 });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoice_id;
    const projectId = session.metadata?.project_id;
    const clientId = session.metadata?.client_id;
    const amountCents = session.amount_total ?? 0;
    const amount = amountCents / 100;

    if (invoiceId && projectId) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id,total,amount_paid,balance_due")
        .eq("id", invoiceId)
        .maybeSingle();

      await supabase.from("payments").insert({
        invoice_id: invoiceId,
        project_id: projectId,
        client_id: clientId || null,
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
        const balance = Math.max(0, total - paid);

        await supabase
          .from("invoices")
          .update({
            status: balance === 0 ? "paid" : "partially_paid",
            amount_paid: paid,
            balance_due: balance,
          })
          .eq("id", invoiceId);
      }

      await supabase.from("projects").update({ status: "booked" }).eq("id", projectId).eq("status", "pending");
    }
  } else if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoice_id;

    if (invoiceId) {
      await supabase.from("invoices").update({ status: "failed" }).eq("id", invoiceId).neq("status", "paid");
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    const invoiceId = paymentIntent.metadata?.invoice_id;

    if (invoiceId) {
      await supabase.from("invoices").update({ status: "failed" }).eq("id", invoiceId).neq("status", "paid");
    }
  } else if (!handledNoopEvents.has(event.type)) {
    console.warn(`Unhandled Stripe webhook event: ${event.type}`);
  }

  await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
    payload: event,
  });

  return new Response("Received", { status: 200 });
}

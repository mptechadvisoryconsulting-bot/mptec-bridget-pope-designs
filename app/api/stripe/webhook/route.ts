import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

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
    const amount = session.amount_total ?? 0;

    if (invoiceId && projectId) {
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

      await supabase
        .from("invoices")
        .update({ status: "paid", amount_paid: amount / 100, balance_due: 0 })
        .eq("id", invoiceId);

      await supabase.from("projects").update({ status: "booked" }).eq("id", projectId).eq("status", "pending");
    }
  }

  await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
    payload: event,
  });

  return new Response("Received", { status: 200 });
}

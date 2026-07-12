import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getStripeReadiness, STRIPE_PAYMENT_MODEL } from "@/lib/stripe/connect";

const checkoutSchema = z.object({ invoiceId: z.string().uuid() });
const nonPayableStatuses = new Set(["paid", "cancelled", "refunded"]);

export async function POST(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const input = checkoutSchema.parse(await request.json());
  const supabase = createAdminClient();
  const stripe = getStripe();
  const readiness = await getStripeReadiness(supabase);

  if (!readiness.ready || !readiness.settings.stripe_connected_account_id) {
    return NextResponse.json(
      {
        success: false,
        message: "Stripe onboarding is not complete. Charges and payouts must be enabled before invoices can be paid.",
      },
      { status: 409 },
    );
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,description,total,balance_due,status,project_id,client_id,proposal_id,invoice_type,bpd_projects(assigned_admin_id,bpd_clients(profile_id,bpd_profiles(email)))")
    .eq("id", input.invoiceId)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });
  }

  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;
  const balanceDue = Number(invoice.balance_due ?? 0);

  if (!canAccess) {
    return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });
  }

  if (nonPayableStatuses.has(invoice.status) || balanceDue <= 0) {
    return NextResponse.json({ success: false, message: "This invoice is not payable." }, { status: 400 });
  }

  const accountId = readiness.settings.stripe_connected_account_id;
  const metadata = {
    invoice_id: invoice.id,
    project_id: invoice.project_id,
    client_id: invoice.client_id,
    proposal_id: invoice.proposal_id ?? "",
    payment_type: invoice.invoice_type,
    invoice_number: invoice.invoice_number,
    stripe_account_id: accountId,
    payment_model: STRIPE_PAYMENT_MODEL,
  };
  const clientProfile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;

  // Bridget Pope Designs is a single-owner deployment: Checkout is created by the platform,
  // and Stripe transfers the charge to the owner's connected account as a destination charge.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appUrl()}/client/invoices/${invoice.id}?payment=success`,
    cancel_url: `${appUrl()}/client/invoices/${invoice.id}?payment=cancelled`,
    customer_email: clientProfile?.email ?? undefined,
    client_reference_id: invoice.id,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: invoice.description ?? `Invoice ${invoice.invoice_number}` },
          unit_amount: Math.round(balanceDue * 100),
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
      on_behalf_of: accountId,
      transfer_data: {
        destination: accountId,
      },
    },
  }, {
    idempotencyKey: `checkout:${invoice.id}:${Math.round(balanceDue * 100)}:${profile.id}`,
  });

  await supabase
    .from("invoices")
    .update({
      stripe_checkout_session_id: session.id,
      stripe_payment_link_url: null,
      checkout_status: "created",
    })
    .eq("id", invoice.id);

  return NextResponse.json({ success: true, url: session.url });
}

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { toCents } from "@/lib/billing/invoice-calculations";
import { calculatePlatformFeeCents, resolvePlatformFeeBasisPoints } from "@/lib/billing/platform-fee";
import { appUrl } from "@/lib/env";
import { paymentCreationDisabledMessage, paymentCreationEnabled } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { DIRECT_CHARGE_V2, getStripeReadiness } from "@/lib/stripe/connect";

const checkoutSchema = z.object({ invoiceId: z.string().uuid() });
const nonPayableStatuses = new Set(["paid", "cancelled", "refunded"]);

function checkoutError(message: string, status = 500, code = "CHECKOUT_ERROR") {
  return NextResponse.json({ success: false, code, message }, { status });
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to create checkout session.";
}

export async function POST(request: Request) {
  let paymentAttemptId: string | null = null;
  let supabase: ReturnType<typeof createAdminClient> | null = null;

  try {
    supabase = createAdminClient();
    const { profile } = await getCurrentProfile();
    if (!profile?.active) {
      return checkoutError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const input = checkoutSchema.parse(await request.json());
    if (!paymentCreationEnabled()) {
      return checkoutError(paymentCreationDisabledMessage(), 503, "PAYMENT_CREATION_DISABLED");
    }

    const stripe = getStripe();
    const readiness = await getStripeReadiness(supabase);

    if (!readiness.ready || !readiness.settings.stripe_connected_account_id) {
      return checkoutError(
        "Stripe onboarding is not complete. Charges and payouts must be enabled before invoices can be paid.",
        409,
        "STRIPE_NOT_READY",
      );
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,description,total,balance_due,status,project_id,client_id,proposal_id,invoice_type,bpd_projects(assigned_admin_id,bpd_clients(profile_id,bpd_profiles(email)))")
      .eq("id", input.invoiceId)
      .single();

    if (error || !invoice) {
      return checkoutError("Invoice not found", 404, "INVOICE_NOT_FOUND");
    }

    const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
    const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
    const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;
    const balanceDue = Number(invoice.balance_due ?? 0);

    if (!canAccess) {
      return checkoutError("Invoice not found", 404, "INVOICE_NOT_FOUND");
    }

    if (nonPayableStatuses.has(invoice.status) || balanceDue <= 0) {
      return checkoutError("This invoice is not payable.", 400, "INVOICE_NOT_PAYABLE");
    }

    const balanceDueCents = toCents(balanceDue);
    const platformFeeBasisPoints = resolvePlatformFeeBasisPoints(readiness.settings);
    const platformFeeAmountCents = calculatePlatformFeeCents(balanceDueCents, platformFeeBasisPoints);
    const accountId = readiness.settings.stripe_connected_account_id;
    paymentAttemptId = randomUUID();
    const idempotencyKey = `checkout_attempt:${paymentAttemptId}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { error: attemptError } = await supabase.from("payment_attempts").insert({
      id: paymentAttemptId,
      invoice_id: invoice.id,
      project_id: invoice.project_id,
      client_id: invoice.client_id,
      profile_id: profile.id,
      amount: balanceDue,
      requested_amount: balanceDue,
      payment_model: DIRECT_CHARGE_V2,
      stripe_account_context: accountId,
      currency: "usd",
      status: "creating",
      idempotency_key: idempotencyKey,
      expires_at: expiresAt,
      metadata: {
        payment_model: DIRECT_CHARGE_V2,
        stripe_account_id: accountId,
        stripe_account_context: accountId,
        balance_due_cents: balanceDueCents,
        platform_fee_basis_points: platformFeeBasisPoints,
        platform_fee_amount_cents: platformFeeAmountCents,
      },
    });

    if (attemptError) {
      return checkoutError("Payment attempt could not be created. The production payment configuration needs attention.", 500, "PAYMENT_ATTEMPT_CREATE_FAILED");
    }

    const metadata = {
      invoice_id: invoice.id,
      project_id: invoice.project_id,
      client_id: invoice.client_id,
      proposal_id: invoice.proposal_id ?? "",
      payment_attempt_id: paymentAttemptId,
      payment_type: invoice.invoice_type,
      invoice_number: invoice.invoice_number,
      stripe_account_id: accountId,
      stripe_account_context: accountId,
      payment_model: DIRECT_CHARGE_V2,
      gross_amount_cents: String(balanceDueCents),
      platform_fee_basis_points: String(platformFeeBasisPoints),
      platform_fee_amount_cents: String(platformFeeAmountCents),
    };
    const clientProfile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;
    const paymentIntentData = {
      metadata,
      ...(platformFeeAmountCents > 0 ? { application_fee_amount: platformFeeAmountCents } : {}),
    };

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
            unit_amount: balanceDueCents,
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: paymentIntentData,
    }, {
      stripeAccount: accountId,
      idempotencyKey,
    });

    const { error: updateAttemptError } = await supabase
      .from("payment_attempts")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        status: "checkout_created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentAttemptId);

    if (updateAttemptError) {
      throw new Error(`Checkout session created but payment attempt persistence failed: ${updateAttemptError.message}`);
    }

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_link_url: null,
        checkout_status: "created",
      })
      .eq("id", invoice.id);

    if (invoiceUpdateError) {
      throw new Error(`Checkout session created but invoice persistence failed: ${invoiceUpdateError.message}`);
    }

    return NextResponse.json({ success: true, url: session.url, paymentAttemptId });
  } catch (error) {
    if (paymentAttemptId && supabase) {
      await supabase
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_message: safeMessage(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentAttemptId);
    }

    console.error("Checkout session creation failed", {
      operation: "stripe_checkout_create",
      errorType: error instanceof Error ? error.name : "UnknownError",
      message: safeMessage(error),
    });

    if (error instanceof z.ZodError) {
      return checkoutError("Invalid checkout request.", 400, "INVALID_CHECKOUT_REQUEST");
    }

    return checkoutError("Unable to create checkout session. Please try again.", 500, "CHECKOUT_CREATE_FAILED");
  }
}

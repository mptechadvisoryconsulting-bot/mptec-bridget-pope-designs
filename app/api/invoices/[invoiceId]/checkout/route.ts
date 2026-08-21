import { NextResponse } from "next/server";
import { requireClientPortalContext } from "@/lib/client-portal";
import { appUrl } from "@/lib/env";
import { isClientVisibleInvoice } from "@/lib/invoices/client-visibility";
import { calculateApplicationFeeCents, normalizePlatformFeeBasisPoints } from "@/lib/payments/platform-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createConnectedCheckoutSession,
  mapConnectedAccountSnapshot,
  retrieveConnectedCheckoutSession,
  retrieveConnectedMerchantAccount,
  stripeServerConfigured,
} from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

const NON_PAYABLE_STATUSES = new Set(["draft", "paid", "cancelled", "refunded", "void"]);
const CHECKOUT_FAILURE_MESSAGE = "Unable to start secure checkout right now. Please try again shortly.";

function moneyToCents(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export async function POST(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const context = await requireClientPortalContext(`/client/invoices/${invoiceId}`);
  const { profile, client } = context;

  if (!stripeServerConfigured()) {
    return NextResponse.json({ success: false, message: "Online payment is temporarily unavailable." }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,invoice_number,project_id,client_id,balance_due,status,stripe_checkout_session_id,updated_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice || invoice.client_id !== client?.id || !isClientVisibleInvoice(invoice)) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }
  if (NON_PAYABLE_STATUSES.has(String(invoice.status)) || Number(invoice.balance_due ?? 0) <= 0) {
    return NextResponse.json({ success: false, message: "This invoice does not have an online balance due." }, { status: 409 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("business_settings")
    .select("id,stripe_connected_account_id,stripe_payment_model,platform_fee_basis_points")
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings?.id || !settings.stripe_connected_account_id) {
    return NextResponse.json({ success: false, message: "Online payment is not connected yet." }, { status: 409 });
  }
  if (settings.stripe_payment_model !== "direct_charge_v2") {
    return NextResponse.json({ success: false, message: "Online payment configuration is not ready." }, { status: 409 });
  }

  try {
    const account = await retrieveConnectedMerchantAccount(settings.stripe_connected_account_id);
    const snapshot = mapConnectedAccountSnapshot(account);
    const { error: syncError } = await supabase
      .from("business_settings")
      .update({
        stripe_charges_enabled: snapshot.cardPaymentsStatus === "active",
        stripe_payouts_enabled: snapshot.payoutsStatus === "active",
        stripe_details_submitted: snapshot.requirementsCurrentlyDue.length === 0,
        stripe_requirements_currently_due: snapshot.requirementsCurrentlyDue,
        stripe_account_last_synced_at: new Date().toISOString(),
        stripe_connect_provisioning_status: snapshot.ready ? "ready" : "onboarding_required",
        payment_readiness_status: snapshot.ready ? "ready" : "action_required",
      })
      .eq("id", settings.id);
    if (syncError) throw new Error("Unable to synchronize Stripe readiness.");

    if (!snapshot.ready) {
      return NextResponse.json(
        { success: false, message: "Online payment setup still needs attention from Bridget Pope Designs." },
        { status: 409 },
      );
    }

    const existingSessionId = invoice.stripe_checkout_session_id as string | null;
    if (existingSessionId) {
      try {
        const existing = await retrieveConnectedCheckoutSession(settings.stripe_connected_account_id, existingSessionId);
        if (existing?.status === "open" && existing?.url) {
          return NextResponse.json({ success: true, url: existing.url, reused: true });
        }
        if (existing?.status === "complete" && existing?.payment_status === "paid") {
          return NextResponse.json({ success: false, message: "This invoice payment is already complete." }, { status: 409 });
        }
      } catch {
        // If Stripe no longer has the prior session, create a fresh session below.
      }
    }

    const amountCents = moneyToCents(invoice.balance_due);
    if (amountCents <= 0) {
      return NextResponse.json({ success: false, message: "This invoice does not have a balance due." }, { status: 409 });
    }

    const basisPoints = normalizePlatformFeeBasisPoints(settings.platform_fee_basis_points);
    const applicationFeeCents = calculateApplicationFeeCents(amountCents, basisPoints);
    const origin = appUrl();
    const idempotencyKey = `bpd-invoice-${invoice.id}-${existingSessionId ?? "initial"}-${amountCents}`;
    const session = await createConnectedCheckoutSession({
      accountId: settings.stripe_connected_account_id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      projectId: invoice.project_id,
      clientId: invoice.client_id,
      customerEmail: profile.email,
      amountCents,
      applicationFeeCents,
      platformFeeBasisPoints: basisPoints,
      successUrl: `${origin}/client/invoices/${invoice.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/client/invoices/${invoice.id}?payment=cancelled`,
      idempotencyKey,
    });

    if (!session?.id || !session?.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.id,
        checkout_status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);
    if (invoiceUpdateError) throw new Error("Unable to persist Stripe checkout state.");

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", {
      invoiceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: CHECKOUT_FAILURE_MESSAGE }, { status: 502 });
  }
}

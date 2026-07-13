import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { recalculateInvoiceFinancials } from "@/lib/billing/invoice-reconciliation";
import { createAdminClient } from "@/lib/supabase/admin";
import { manualPaymentSchema } from "@/lib/validation/manual-payment-schema";

function money(value: unknown) {
  return Number(Number(value ?? 0).toFixed(2));
}

function parsePaidAt(value: string) {
  // Accept YYYY-MM-DD from <input type="date"> and store as ISO midnight UTC for that calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function GET(_request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await context.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id,amount,gross_amount,payment_method,payment_model,status,paid_at,metadata,created_at")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, payments: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await context.params;
  const parsed = manualPaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid payment details." },
      { status: 400 },
    );
  }

  const paidAt = parsePaidAt(parsed.data.paidAt);
  if (!paidAt) {
    return NextResponse.json({ success: false, message: "Payment date is invalid." }, { status: 400 });
  }

  const amount = money(parsed.data.amount);
  const supabase = createAdminClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,project_id,client_id,total,amount_paid,balance_due,status,invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return NextResponse.json({ success: false, message: invoiceError.message }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }
  if (["cancelled", "refunded"].includes(String(invoice.status))) {
    return NextResponse.json(
      { success: false, message: "Payments cannot be recorded on a cancelled or refunded invoice." },
      { status: 409 },
    );
  }

  const balanceDue = money(invoice.balance_due ?? invoice.total);
  if (amount - balanceDue > 0.009) {
    return NextResponse.json(
      {
        success: false,
        message: `Amount exceeds the remaining balance of $${balanceDue.toFixed(2)}.`,
      },
      { status: 409 },
    );
  }

  const note = parsed.data.note?.trim() || null;
  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      project_id: invoice.project_id,
      client_id: invoice.client_id,
      amount,
      gross_amount: amount,
      platform_fee_amount: 0,
      net_amount: amount,
      currency: "usd",
      payment_type: "invoice",
      payment_method: parsed.data.paymentMethod,
      payment_model: "manual",
      stripe_account_context: null,
      status: "paid",
      paid_at: paidAt,
      metadata: {
        source: "manual",
        recorded_by_profile_id: admin.profile.id,
        note,
        payment_method: parsed.data.paymentMethod,
      },
    })
    .select("id,amount,payment_method,paid_at,status,payment_model")
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, message: insertError.message }, { status: 500 });
  }

  const financials = await recalculateInvoiceFinancials(supabase, invoice.id);

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    action: "manual_payment_recorded",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: {
      payment_id: payment.id,
      amount,
      payment_method: parsed.data.paymentMethod,
      invoice_number: invoice.invoice_number,
      resulting_status: financials.status,
      balance_due: financials.balanceDue,
    },
  });

  if (invoice.client_id) {
    const { data: client } = await supabase.from("clients").select("profile_id").eq("id", invoice.client_id).maybeSingle();
    if (client?.profile_id) {
      await supabase.from("notifications").insert({
        recipient_id: client.profile_id,
        type: "payment_recorded",
        title: "Payment recorded",
        message: `A payment of $${amount.toFixed(2)} was recorded on invoice ${invoice.invoice_number}.`,
        project_id: invoice.project_id,
        action_url: `/client/invoices/${invoice.id}`,
      });
    }
  }

  return NextResponse.json({
    success: true,
    payment,
    invoice: {
      id: invoice.id,
      amount_paid: financials.netPaid,
      balance_due: financials.balanceDue,
      status: financials.status,
    },
  });
}

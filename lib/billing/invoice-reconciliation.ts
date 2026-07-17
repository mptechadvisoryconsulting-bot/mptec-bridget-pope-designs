type SupabaseAdmin = {
  from(table: string): any;
};

const successfulPaymentStatuses = ["paid", "partially_refunded", "refunded"];
const successfulRefundStatuses = ["succeeded"];

type PaymentRow = {
  amount?: number | string | null;
  gross_amount?: number | string | null;
  status?: string | null;
};

type AdjustmentRow = {
  amount?: number | string | null;
  status?: string | null;
};

function money(value: unknown) {
  return Number(Number(value ?? 0).toFixed(2));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function derivePaymentRefundStatus(grossAmount: number, succeededRefundAmount: number, hasPendingRefund = false) {
  const gross = money(grossAmount);
  const refunded = money(succeededRefundAmount);

  if (hasPendingRefund) return "refund_pending";
  if (refunded <= 0) return "paid";
  if (refunded < gross) return "partially_refunded";
  return "refunded";
}

export function deriveInvoiceStatusAfterReconciliation(input: {
  total: number;
  netPaid: number;
  grossPaid: number;
  refunded: number;
  currentStatus: string;
}) {
  const total = money(input.total);
  const netPaid = Math.max(0, money(input.netPaid));
  const grossPaid = money(input.grossPaid);
  const refunded = money(input.refunded);
  const balanceDue = Math.max(0, roundMoney(total - netPaid));

  let status = input.currentStatus;
  if (grossPaid > 0 && netPaid <= 0 && refunded > 0) {
    status = "refunded";
  } else if (balanceDue <= 0 && netPaid > 0) {
    status = "paid";
  } else if (netPaid > 0) {
    status = "partially_paid";
  } else if (input.currentStatus === "draft") {
    status = "draft";
  } else if (input.currentStatus === "payment_arrangement") {
    status = "payment_arrangement";
  } else if (input.currentStatus === "sent" || input.currentStatus === "viewed") {
    status = input.currentStatus;
  }

  return { balanceDue, netPaid, status };
}

export async function recalculatePaymentRefundState(supabase: SupabaseAdmin, paymentId: string) {
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id,gross_amount,amount")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) throw new Error(paymentError?.message ?? "Payment not found for refund reconciliation");

  const { data: adjustments, error: adjustmentError } = await supabase
    .from("payment_adjustments")
    .select("amount,status")
    .eq("payment_id", paymentId)
    .eq("adjustment_type", "refund");

  // Prod may not have bpd_payment_adjustments yet (Stripe-era table). Treat as no refunds.
  const adjustmentRows = adjustmentError ? [] : ((adjustments ?? []) as AdjustmentRow[]);

  const succeededRefundAmount = adjustmentRows
    .filter((adjustment) => successfulRefundStatuses.includes(String(adjustment.status)))
    .reduce((sum, adjustment) => sum + money(adjustment.amount), 0);
  const hasPendingRefund = adjustmentRows.some((adjustment) => !successfulRefundStatuses.includes(String(adjustment.status)));
  const status = derivePaymentRefundStatus(money(payment.gross_amount ?? payment.amount), succeededRefundAmount, hasPendingRefund);
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      refunded_amount: roundMoney(succeededRefundAmount),
      status,
    })
    .eq("id", paymentId);

  if (updateError) throw new Error(updateError.message);
  return { refundedAmount: roundMoney(succeededRefundAmount), status };
}

export async function recalculateInvoiceFinancials(supabase: SupabaseAdmin, invoiceId: string) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,total,status")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Invoice not found for reconciliation");

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id,gross_amount,amount,status")
    .eq("invoice_id", invoiceId)
    .in("status", successfulPaymentStatuses);

  if (paymentsError) throw new Error(paymentsError.message);

  const { data: refunds, error: refundsError } = await supabase
    .from("payment_adjustments")
    .select("amount,status")
    .eq("invoice_id", invoiceId)
    .eq("adjustment_type", "refund")
    .in("status", successfulRefundStatuses);

  // Missing payment_adjustments table must not block recording manual payments.
  const refundRows = refundsError ? [] : ((refunds ?? []) as AdjustmentRow[]);

  const grossPaid = roundMoney(((payments ?? []) as PaymentRow[]).reduce((sum, payment) => sum + money(payment.gross_amount ?? payment.amount), 0));
  const refunded = roundMoney(refundRows.reduce((sum, refund) => sum + money(refund.amount), 0));
  const netPaidRaw = roundMoney(grossPaid - refunded);
  const derived = deriveInvoiceStatusAfterReconciliation({
    total: money(invoice.total),
    netPaid: Math.max(0, netPaidRaw),
    grossPaid,
    refunded,
    currentStatus: String(invoice.status ?? "draft"),
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: derived.netPaid,
      balance_due: derived.balanceDue,
      status: derived.status,
      checkout_status: derived.balanceDue <= 0 && derived.netPaid > 0 ? "paid" : invoice.status === "draft" ? null : "partial",
    })
    .eq("id", invoiceId);

  if (updateError) throw new Error(updateError.message);
  return { grossPaid, refunded, netPaid: derived.netPaid, balanceDue: derived.balanceDue, status: derived.status };
}

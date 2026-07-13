import { currency } from "@/lib/currency";
import { manualPaymentMethodLabels, type ManualPaymentMethod } from "@/lib/validation/manual-payment-schema";

type PaymentRow = {
  id: string;
  amount?: number | string | null;
  gross_amount?: number | string | null;
  payment_method?: string | null;
  payment_model?: string | null;
  status?: string | null;
  paid_at?: string | null;
  metadata?: { note?: string | null } | null;
};

function methodLabel(value?: string | null) {
  if (!value) return "Payment";
  if (value in manualPaymentMethodLabels) {
    return manualPaymentMethodLabels[value as ManualPaymentMethod];
  }
  return value.replaceAll("_", " ");
}

export function InvoicePaymentHistory({ payments }: { payments: PaymentRow[] }) {
  return (
    <section className="panel">
      <h2>Payment History</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "—"}</td>
              <td>
                {methodLabel(payment.payment_method)}
                {payment.payment_model === "manual" ? " (manual)" : ""}
              </td>
              <td>{currency(Number(payment.gross_amount ?? payment.amount ?? 0))}</td>
              <td>
                <span className="status">{payment.status}</span>
              </td>
              <td>{payment.metadata?.note || "—"}</td>
            </tr>
          ))}
          {!payments.length ? (
            <tr>
              <td colSpan={5}>No payments recorded yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

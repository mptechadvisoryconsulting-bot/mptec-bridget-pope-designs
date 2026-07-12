import { CreditCard } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";

export function PaymentCard({
  balanceDue = 0,
  dueDate,
  paymentUrl = "/client/invoices",
}: {
  balanceDue?: number;
  dueDate?: string | null;
  paymentUrl?: string;
}) {
  return (
    <section className="panel">
      <h2>Next Payment</h2>
      <span className="mini-meta">Balance Due</span>
      <strong style={{ display: "block", fontSize: 28, margin: "6px 0" }}>{currency(balanceDue)}</strong>
      <p className="mini-meta">Due by {dueDate ?? "No open invoice"}</p>
      <ButtonLink href={paymentUrl}>
        <CreditCard size={16} /> {balanceDue > 0 ? "Make Payment" : "View Invoices"}
      </ButtonLink>
      <p className="mini-meta" style={{ marginBottom: 0, marginTop: 10 }}>Secured by Stripe when payment is available</p>
    </section>
  );
}

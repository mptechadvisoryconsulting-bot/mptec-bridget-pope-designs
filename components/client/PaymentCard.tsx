import { CreditCard } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function PaymentCard() {
  return (
    <section className="panel">
      <h2>Next Payment</h2>
      <span className="mini-meta">Balance Due</span>
      <strong style={{ display: "block", fontSize: 28, margin: "6px 0" }}>$2,450.00</strong>
      <p className="mini-meta">Due by May 20, 2025</p>
      <ButtonLink href="/client/payments">
        <CreditCard size={16} /> Make Payment
      </ButtonLink>
      <p className="mini-meta" style={{ marginBottom: 0, marginTop: 10 }}>Secured by Stripe</p>
    </section>
  );
}

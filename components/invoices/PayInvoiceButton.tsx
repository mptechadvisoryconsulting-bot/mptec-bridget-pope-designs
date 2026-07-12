"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function createCheckout() {
    setIsLoading(true);
    setMessage("");

    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    const payload = await response.json();

    if (response.ok && payload.url) {
      window.location.href = payload.url;
      return;
    }

    setMessage(payload.message ?? "Unable to create a secure checkout session.");
    setIsLoading(false);
  }

  return (
    <div className="pay-invoice-action">
      <Button disabled={isLoading} onClick={createCheckout} type="button">
        <CreditCard size={16} /> {isLoading ? "Opening Stripe..." : "Pay Invoice"}
      </Button>
      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}

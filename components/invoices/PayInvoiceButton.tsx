"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isValidStripeRedirectUrl } from "@/lib/payment-setup-client";
import { safeFetch } from "@/lib/safe-fetch";

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function createCheckout() {
    setIsLoading(true);
    setMessage("");

    const result = await safeFetch<{ url?: string; message?: string }>("/api/stripe/create-checkout-session", {
      method: "POST",
      body: { invoiceId },
    });

    if (result.ok && result.data?.url && isValidStripeRedirectUrl(result.data.url)) {
      window.location.href = result.data.url;
      return;
    }

    setMessage(result.ok ? "Payment setup returned an invalid response." : result.data?.message ?? result.message);
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

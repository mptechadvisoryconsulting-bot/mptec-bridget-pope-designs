"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StripeCheckoutButton({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/checkout`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.url) {
        setMessage(payload?.message ?? "Secure checkout is unavailable right now.");
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setMessage("Secure checkout is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Button disabled={busy} onClick={() => void startCheckout()} type="button">
        <CreditCard size={16} /> {busy ? "Opening secure checkout…" : "Pay securely with Stripe"}
      </Button>
      {message ? <p className="form-error" role="alert" style={{ margin: 0 }}>{message}</p> : null}
    </div>
  );
}

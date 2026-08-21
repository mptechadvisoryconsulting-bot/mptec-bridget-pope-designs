"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StripeConnectSetupButton({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function openStripe() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payments/connect", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        setMessage(payload?.message ?? "Unable to open Stripe setup.");
        return;
      }
      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }
      setMessage(payload.ready ? "Stripe payments are ready." : "Stripe setup is not complete yet.");
    } catch {
      setMessage("Unable to open Stripe setup. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Button disabled={busy} onClick={() => void openStripe()} type="button" variant={ready ? "secondary" : "primary"}>
        <ExternalLink size={16} />
        {busy ? "Checking Stripe…" : ready ? "Check Stripe status" : "Connect / Continue Stripe setup"}
      </Button>
      {message ? <p className="mini-meta" style={{ margin: 0 }}>{message}</p> : null}
    </div>
  );
}

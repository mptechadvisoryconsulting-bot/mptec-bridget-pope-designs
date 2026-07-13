"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentSetupState = "not_connected" | "onboarding_required" | "restricted" | "ready" | "payout_issue";

type PaymentSetupCardProps = {
  accountLastSyncedAt?: string | null;
  canManage: boolean;
  chargesEnabled: boolean;
  connectedAccountId?: string | null;
  detailsSubmitted: boolean;
  paymentReadinessStatus: PaymentSetupState;
  payoutsEnabled: boolean;
  platformFeeBasisPoints: number;
  requirementsCurrentlyDue: string[];
  requirementsDisabledReason?: string | null;
};

const stateLabels: Record<PaymentSetupState, string> = {
  not_connected: "NOT_CONNECTED",
  onboarding_required: "ONBOARDING_REQUIRED",
  restricted: "RESTRICTED",
  ready: "READY",
  payout_issue: "PAYOUT_ISSUE",
};

function primaryActionLabel(state: PaymentSetupState) {
  if (state === "not_connected") return "Set Up Payments";
  if (state === "ready") return "Manage Payment Account";
  if (state === "payout_issue") return "Resolve Payout Issue";
  if (state === "restricted") return "Resolve in Stripe";
  return "Continue Stripe Setup";
}

export function PaymentSetupCard({
  accountLastSyncedAt,
  canManage,
  chargesEnabled,
  connectedAccountId,
  detailsSubmitted,
  paymentReadinessStatus,
  payoutsEnabled,
  platformFeeBasisPoints,
  requirementsCurrentlyDue,
  requirementsDisabledReason,
}: PaymentSetupCardProps) {
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function startOnboarding() {
    setIsWorking(true);
    setMessage("");
    const response = await fetch("/api/admin/stripe/connect", { method: "POST" });
    const payload = await response.json();

    if (response.ok && payload.url) {
      window.location.href = payload.url;
      return;
    }

    setMessage(payload.message ?? "Unable to create Stripe onboarding link.");
    setIsWorking(false);
  }

  async function refreshStatus() {
    setIsWorking(true);
    setMessage("");
    const response = await fetch("/api/admin/stripe/status");
    const payload = await response.json();
    setMessage(response.ok && payload.ready ? "Stripe payments and payouts are ready." : payload.message ?? "Stripe setup still needs attention.");
    setIsWorking(false);
  }

  const feePercent = (platformFeeBasisPoints / 100).toFixed(2).replace(/\.00$/, "");

  return (
    <section className="panel span-2">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Owner Payment Setup</span>
          <h2>Stripe Connect Payouts</h2>
        </div>
        <span className={`status ${paymentReadinessStatus === "ready" ? "status-ready" : ""}`}>
          {stateLabels[paymentReadinessStatus]}
        </span>
      </div>
      <p className="mini-meta">
        Payments are processed through Stripe Checkout and routed to the owner connected account. Bank routing and account numbers are never collected in this application.
      </p>
      <p className="mini-meta">Platform payment fee: {feePercent}%.</p>
      <ul className="list">
        <li><span>Connected Account</span><span className="status">{connectedAccountId ?? "Not connected"}</span></li>
        <li><span>Payments Enabled</span><span className="status">{chargesEnabled ? "Enabled" : "Pending"}</span></li>
        <li><span>Payouts Enabled</span><span className="status">{payoutsEnabled ? "Enabled" : "Pending"}</span></li>
        <li><span>Details Submitted</span><span className="status">{detailsSubmitted ? "Submitted" : "Required"}</span></li>
      </ul>
      {requirementsDisabledReason ? <p className="form-error">Stripe restriction: {requirementsDisabledReason}</p> : null}
      {requirementsCurrentlyDue.length ? <p className="form-error">Stripe needs: {requirementsCurrentlyDue.join(", ")}</p> : null}
      {accountLastSyncedAt ? <p className="mini-meta">Last synced {new Date(accountLastSyncedAt).toLocaleString("en-US")}</p> : null}
      {!canManage ? <p className="form-error">Only the owner account can start or modify payout onboarding.</p> : null}
      {message ? <p className={message.includes("ready") ? "form-success" : "form-error"}>{message}</p> : null}
      <div className="topbar-actions">
        <Button disabled={!canManage || isWorking} onClick={startOnboarding} type="button">
          {paymentReadinessStatus === "ready" ? <ExternalLink size={16} /> : <CreditCard size={16} />}
          {isWorking ? "Opening..." : primaryActionLabel(paymentReadinessStatus)}
        </Button>
        <Button disabled={!canManage || isWorking || !connectedAccountId} onClick={refreshStatus} type="button" variant="light">
          <RefreshCw size={16} /> Refresh Status
        </Button>
      </div>
    </section>
  );
}

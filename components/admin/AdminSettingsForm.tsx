"use client";

import { useState } from "react";
import { CreditCard, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type StripeSettings = {
  connectedAccountId?: string | null;
  paymentModel: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  requirementsDisabledReason?: string | null;
  accountLastSyncedAt?: string | null;
};

export function AdminSettingsForm({
  businessEmail,
  emailLastTestSentAt,
  emailLastError,
  stripeSettings,
}: {
  businessEmail: string;
  emailLastTestSentAt?: string | null;
  emailLastError?: string | null;
  stripeSettings: StripeSettings;
}) {
  const [message, setMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState(emailLastError ? `Last email test failed: ${emailLastError}` : emailLastTestSentAt ? `Last email test sent ${new Date(emailLastTestSentAt).toLocaleString("en-US")}` : "");
  const [stripeStatus, setStripeStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);

  async function saveSettings(formData: FormData) {
    setIsSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessEmail: String(formData.get("businessEmail") ?? "") }),
    });
    const payload = await response.json();

    setMessage(payload.success ? "Inquiry email saved." : payload.message ?? "Unable to save settings.");
    setIsSaving(false);
  }

  async function sendTestEmail() {
    setIsTestingEmail(true);
    setEmailStatus("");
    const response = await fetch("/api/admin/settings/test-email", { method: "POST" });
    const payload = await response.json();
    setEmailStatus(payload.success ? "Test email sent to the inquiry recipient." : payload.message ?? "Unable to send test email.");
    setIsTestingEmail(false);
  }

  async function connectStripe() {
    setIsConnectingStripe(true);
    setStripeStatus("");
    const response = await fetch("/api/admin/stripe/connect", { method: "POST" });
    const payload = await response.json();

    if (response.ok && payload.url) {
      window.location.href = payload.url;
      return;
    }

    setStripeStatus(payload.message ?? "Unable to create Stripe onboarding link.");
    setIsConnectingStripe(false);
  }

  async function refreshStripe() {
    setIsConnectingStripe(true);
    setStripeStatus("");
    const response = await fetch("/api/admin/stripe/status");
    const payload = await response.json();
    setStripeStatus(payload.ready ? "Stripe is ready for checkout and payouts." : "Stripe is connected, but onboarding or payout setup is not complete.");
    if (!response.ok) setStripeStatus(payload.message ?? "Unable to refresh Stripe status.");
    setIsConnectingStripe(false);
  }

  const stripeReady = stripeSettings.connectedAccountId && stripeSettings.chargesEnabled && stripeSettings.payoutsEnabled;

  return (
    <div className="dashboard-grid">
      <form action={saveSettings} className="panel form-grid span-2">
        <h2 className="wide">Consultation Inquiry Email</h2>
        <p className="mini-meta wide">Landing-page consultation requests will send owner notifications to this address.</p>
        <Field label="Inquiry Recipient Email">
          <Input defaultValue={businessEmail} name="businessEmail" placeholder="inquiries@bridgetpopedesigns.com" required type="email" />
        </Field>
        {message ? <p className={message.includes("saved") ? "form-success wide" : "form-error wide"}>{message}</p> : null}
        {emailStatus ? <p className={emailStatus.includes("sent") ? "form-success wide" : "form-error wide"}>{emailStatus}</p> : null}
        <div className="topbar-actions wide">
          <Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save Settings"}</Button>
          <Button disabled={isTestingEmail} onClick={sendTestEmail} type="button" variant="light">
            <MailCheck size={16} /> {isTestingEmail ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
      </form>

      <section className="panel span-2">
        <h2>Stripe Connect Payments</h2>
        <p className="mini-meta">
          Payment model: {stripeSettings.paymentModel}. Checkout Sessions transfer invoice payments to the owner's connected Stripe account.
        </p>
        <ul className="list">
          <li><span>Connected account</span><span className="status">{stripeSettings.connectedAccountId ?? "Not connected"}</span></li>
          <li><span>Charges enabled</span><span className="status">{stripeSettings.chargesEnabled ? "Enabled" : "Pending"}</span></li>
          <li><span>Payouts enabled</span><span className="status">{stripeSettings.payoutsEnabled ? "Enabled" : "Pending"}</span></li>
          <li><span>Details submitted</span><span className="status">{stripeSettings.detailsSubmitted ? "Submitted" : "Required"}</span></li>
          {stripeSettings.requirementsDisabledReason ? (
            <li><span>Disabled reason</span><span className="status">{stripeSettings.requirementsDisabledReason}</span></li>
          ) : null}
        </ul>
        {stripeSettings.requirementsCurrentlyDue.length ? (
          <p className="form-error">Stripe still requires: {stripeSettings.requirementsCurrentlyDue.join(", ")}</p>
        ) : null}
        {stripeSettings.accountLastSyncedAt ? <p className="mini-meta">Last synced {new Date(stripeSettings.accountLastSyncedAt).toLocaleString("en-US")}</p> : null}
        {stripeStatus ? <p className={stripeStatus.includes("ready") ? "form-success" : "form-error"}>{stripeStatus}</p> : null}
        <div className="topbar-actions">
          <Button disabled={isConnectingStripe} onClick={connectStripe} type="button">
            <CreditCard size={16} /> {stripeReady ? "Update Stripe Account" : "Connect Stripe"}
          </Button>
          <Button disabled={isConnectingStripe || !stripeSettings.connectedAccountId} onClick={refreshStripe} type="button" variant="light">
            <RefreshCw size={16} /> Refresh Status
          </Button>
        </div>
      </section>
    </div>
  );
}

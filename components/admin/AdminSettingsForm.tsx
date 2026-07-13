"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
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
  currentRole,
  emailLastTestSentAt,
  emailLastError,
  emailReadinessStatus,
  platformFeeBasisPoints,
  stripeSettings,
}: {
  businessEmail: string;
  currentRole: string;
  emailLastTestSentAt?: string | null;
  emailLastError?: string | null;
  emailReadinessStatus: string;
  platformFeeBasisPoints: number;
  stripeSettings: StripeSettings;
}) {
  const [message, setMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState(emailLastError ? `Last email test failed: ${emailLastError}` : emailLastTestSentAt ? `Last email test sent ${new Date(emailLastTestSentAt).toLocaleString("en-US")}` : "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const canManageOwnerSettings = currentRole === "owner";

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

  const stripeReady = stripeSettings.connectedAccountId && stripeSettings.chargesEnabled && stripeSettings.payoutsEnabled;

  return (
    <div className="dashboard-grid">
      <form action={saveSettings} className="panel form-grid span-2">
        <h2 className="wide">Consultation Inquiry Email</h2>
        <p className="mini-meta wide">Landing-page consultation requests will send owner notifications to this address.</p>
        <p className="mini-meta wide">Readiness: {emailReadinessStatus.replace(/_/g, " ")}</p>
        <Field label="Inquiry Recipient Email">
          <Input defaultValue={businessEmail} disabled={!canManageOwnerSettings} name="businessEmail" placeholder="inquiries@bridgetpopedesigns.com" required type="email" />
        </Field>
        {!canManageOwnerSettings ? <p className="form-error wide">Only the owner account can change business email settings.</p> : null}
        {message ? <p className={message.includes("saved") ? "form-success wide" : "form-error wide"}>{message}</p> : null}
        {emailStatus ? <p className={emailStatus.includes("sent") ? "form-success wide" : "form-error wide"}>{emailStatus}</p> : null}
        <div className="topbar-actions wide">
          <Button disabled={isSaving || !canManageOwnerSettings} type="submit">{isSaving ? "Saving..." : "Save Settings"}</Button>
          <Button disabled={isTestingEmail || !canManageOwnerSettings} onClick={sendTestEmail} type="button" variant="light">
            <MailCheck size={16} /> {isTestingEmail ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
      </form>

      <section className="panel span-2">
        <h2>Payment Setup / Payout Status</h2>
        <p className="mini-meta">
          Payment setup now lives in a dedicated owner workflow. Checkout Sessions transfer invoice payments to the owner's connected Stripe account.
        </p>
        <p className="mini-meta">Platform payment fee: {(platformFeeBasisPoints / 100).toFixed(2).replace(/\.00$/, "")}%.</p>
        <p className="mini-meta">Direct payout setup is owner-only. Admin users can view readiness but cannot replace the payment destination.</p>
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
        <div className="topbar-actions">
          <ButtonLink href="/admin/settings/payments">{stripeReady ? "Open Payment Setup" : "Set Up Payments"}</ButtonLink>
        </div>
      </section>
    </div>
  );
}

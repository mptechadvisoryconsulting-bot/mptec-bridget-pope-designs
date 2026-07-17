"use client";

import { FormEvent, useState } from "react";
import { MailCheck, Save } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { readinessLabel } from "@/lib/email/delivery";
import { safeFetch } from "@/lib/safe-fetch";

type OwnerEmailSettings = {
  businessDisplayName: string;
  inquiryRecipientEmail: string;
  invoiceFromDisplayName: string;
  invoiceReplyTo: string;
  ownerMessageNotificationEmail: string;
  clientEmailNotificationsEnabled: boolean;
  inquiryNotificationsEnabled: boolean;
  invoiceNotificationsEnabled: boolean;
  paymentConfirmationNotificationsEnabled: boolean;
};

type EmailReadiness = {
  status: "NOT_CONFIGURED" | "READY" | "PROVIDER_ERROR" | "SENDER_VERIFICATION_REQUIRED";
  lastSuccessAt?: string | null;
  lastMessageId?: string | null;
  lastFailureAt?: string | null;
  lastErrorSafe?: string | null;
  lastTestSentAt?: string | null;
};

type SettingsApiResponse = {
  success: boolean;
  message?: string;
  settings?: {
    businessDisplayName: string | null;
    inquiryRecipientEmail: string | null;
    invoiceFromDisplayName: string | null;
    invoiceReplyTo: string | null;
    ownerMessageNotificationEmail: string | null;
    clientEmailNotificationsEnabled: boolean;
    inquiryNotificationsEnabled: boolean;
    invoiceNotificationsEnabled: boolean;
    paymentConfirmationNotificationsEnabled: boolean;
    emailReadinessStatus: EmailReadiness["status"];
    emailProviderLastSuccessAt: string | null;
    emailProviderLastMessageId: string | null;
    emailProviderLastFailureAt: string | null;
    emailLastErrorSafe: string | null;
    emailLastTestSentAt: string | null;
  } | null;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US");
}

function fromApiSettings(row: NonNullable<SettingsApiResponse["settings"]>): { form: OwnerEmailSettings; readiness: EmailReadiness } {
  return {
    form: {
      businessDisplayName: row.businessDisplayName ?? "",
      inquiryRecipientEmail: row.inquiryRecipientEmail ?? "",
      invoiceFromDisplayName: row.invoiceFromDisplayName ?? "",
      invoiceReplyTo: row.invoiceReplyTo ?? "",
      ownerMessageNotificationEmail: row.ownerMessageNotificationEmail ?? "",
      clientEmailNotificationsEnabled: row.clientEmailNotificationsEnabled,
      inquiryNotificationsEnabled: row.inquiryNotificationsEnabled,
      invoiceNotificationsEnabled: row.invoiceNotificationsEnabled,
      paymentConfirmationNotificationsEnabled: row.paymentConfirmationNotificationsEnabled,
    },
    readiness: {
      status: row.emailReadinessStatus,
      lastSuccessAt: row.emailProviderLastSuccessAt,
      lastMessageId: row.emailProviderLastMessageId,
      lastFailureAt: row.emailProviderLastFailureAt,
      lastErrorSafe: row.emailLastErrorSafe,
      lastTestSentAt: row.emailLastTestSentAt,
    },
  };
}

export function AdminSettingsForm({
  currentRole,
  ownerEmailSettings,
  emailReadiness,
}: {
  currentRole: string;
  ownerEmailSettings: OwnerEmailSettings;
  emailReadiness: EmailReadiness;
}) {
  const [form, setForm] = useState(ownerEmailSettings);
  const [readiness, setReadiness] = useState(emailReadiness);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [emailStatusIsError, setEmailStatusIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const canManageOwnerSettings = currentRole === "owner";

  function update<K extends keyof OwnerEmailSettings>(key: K, value: OwnerEmailSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const result = await safeFetch<SettingsApiResponse>("/api/admin/settings", {
      method: "PUT",
      body: {
        businessDisplayName: form.businessDisplayName,
        inquiryRecipientEmail: form.inquiryRecipientEmail,
        invoiceFromDisplayName: form.invoiceFromDisplayName,
        invoiceReplyTo: form.invoiceReplyTo,
        ownerMessageNotificationEmail: form.ownerMessageNotificationEmail,
        clientEmailNotificationsEnabled: form.clientEmailNotificationsEnabled,
        inquiryNotificationsEnabled: form.inquiryNotificationsEnabled,
        invoiceNotificationsEnabled: form.invoiceNotificationsEnabled,
        paymentConfirmationNotificationsEnabled: form.paymentConfirmationNotificationsEnabled,
      },
    });

    setIsSaving(false);

    if (!result.ok) {
      setMessageIsError(true);
      setMessage(result.data?.message ?? result.message);
      return;
    }

    setMessageIsError(false);
    setMessage("Owner email settings saved.");
    if (result.data?.settings) {
      const { form: nextForm, readiness: nextReadiness } = fromApiSettings(result.data.settings);
      setForm(nextForm);
      setReadiness(nextReadiness);
    }
  }

  async function sendTestEmail() {
    setIsTestingEmail(true);
    setEmailStatus("");

    const result = await safeFetch<{ success: boolean; message?: string }>("/api/admin/settings/test-email", { method: "POST" });

    if (!result.ok) {
      setEmailStatusIsError(true);
      setEmailStatus(result.data?.message ?? result.message);
      setIsTestingEmail(false);
      return;
    }

    setEmailStatusIsError(false);
    setEmailStatus("Test email sent to the inquiry recipient.");

    const refreshed = await safeFetch<SettingsApiResponse>("/api/admin/settings", { method: "GET" });
    if (refreshed.ok && refreshed.data?.settings) {
      const { form: nextForm, readiness: nextReadiness } = fromApiSettings(refreshed.data.settings);
      setForm(nextForm);
      setReadiness(nextReadiness);
    }
    setIsTestingEmail(false);
  }

  return (
    <div className="dashboard-grid">
      <form className="panel form-grid span-2" onSubmit={saveSettings}>
        <h2 className="wide">Owner Email Settings</h2>
        <p className="mini-meta wide">These settings control who receives inquiry, invoice, message, and project notifications, and how outgoing email identifies the business.</p>

        <Field label="Business Display Name">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("businessDisplayName", event.target.value)}
            placeholder="Bridget Pope Designs"
            required
            value={form.businessDisplayName}
          />
        </Field>
        <Field label="Project Email Display Name">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("invoiceFromDisplayName", event.target.value)}
            placeholder="Bridget Pope Designs"
            required
            value={form.invoiceFromDisplayName}
          />
        </Field>
        <Field label="Inquiry Recipient Email">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("inquiryRecipientEmail", event.target.value)}
            placeholder="inquiries@bridgetpopedesigns.com"
            type="email"
            value={form.inquiryRecipientEmail}
          />
        </Field>
        <Field label="Project Reply-To Email">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("invoiceReplyTo", event.target.value)}
            placeholder="billing@bridgetpopedesigns.com"
            type="email"
            value={form.invoiceReplyTo}
          />
        </Field>
        <Field label="Owner Message Notification Email">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("ownerMessageNotificationEmail", event.target.value)}
            placeholder="owner@bridgetpopedesigns.com"
            type="email"
            value={form.ownerMessageNotificationEmail}
          />
        </Field>

        <div className="field wide">
          <span>Notification Toggles</span>
          <div className="checkbox-grid">
            <label className="check-row">
              <input
                checked={form.clientEmailNotificationsEnabled}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("clientEmailNotificationsEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Client email notifications</span>
            </label>
            <label className="check-row">
              <input
                checked={form.inquiryNotificationsEnabled}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("inquiryNotificationsEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Inquiry notifications</span>
            </label>
            <label className="check-row">
              <input
                checked={form.invoiceNotificationsEnabled}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("invoiceNotificationsEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Invoice notifications</span>
            </label>
            <label className="check-row">
              <input
                checked={form.paymentConfirmationNotificationsEnabled}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("paymentConfirmationNotificationsEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Project completion notifications</span>
            </label>
          </div>
        </div>

        {!canManageOwnerSettings ? <p className="form-error wide">Only the owner account can change business email settings.</p> : null}
        {message ? <p className={messageIsError ? "form-error wide" : "form-success wide"}>{message}</p> : null}
        <div className="topbar-actions wide">
          <Button disabled={isSaving || !canManageOwnerSettings} type="submit">
            <Save size={16} /> {isSaving ? "Saving..." : "Save Settings"}
          </Button>
          <Button disabled={isTestingEmail || !canManageOwnerSettings} onClick={sendTestEmail} type="button" variant="light">
            <MailCheck size={16} /> {isTestingEmail ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
        {emailStatus ? <p className={emailStatusIsError ? "form-error wide" : "form-success wide"}>{emailStatus}</p> : null}
      </form>

      <section className="panel span-2">
        <h2>Email Delivery Readiness</h2>
        <ul className="list">
          <li><span>Readiness</span><span className="status">{readinessLabel(readiness.status)}</span></li>
          <li><span>Last successful send</span><span className="status">{formatTimestamp(readiness.lastSuccessAt)}</span></li>
          <li><span>Provider message ID</span><span className="status">{readiness.lastMessageId ?? "None"}</span></li>
          <li><span>Last failed send</span><span className="status">{formatTimestamp(readiness.lastFailureAt)}</span></li>
          <li><span>Last test sent</span><span className="status">{formatTimestamp(readiness.lastTestSentAt)}</span></li>
        </ul>
        {readiness.lastErrorSafe ? <p className="form-error">{readiness.lastErrorSafe}</p> : null}
      </section>

      <section className="panel span-2">
        <h2>Internal Billing</h2>
        <p className="mini-meta">
          Proposals, contracts, invoices, and manual payment records are managed in this app. Clients review them in the portal.
        </p>
        <div className="topbar-actions">
          <ButtonLink href="/admin/settings/payments">Billing guidance</ButtonLink>
          <ButtonLink href="/admin/invoices" variant="light">
            Open invoices
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

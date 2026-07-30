"use client";

import { FormEvent, useState } from "react";
import { MailCheck, Save } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
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
  paymentRemindersEnabled: boolean;
  showInventoryNav: boolean;
  showTeamNav: boolean;
  showContractsNav: boolean;
  cashAppHandle: string;
  zelleHandle: string;
  venmoHandle: string;
  bankTransferNotes: string;
  checkPayableTo: string;
  paymentInstructionsNotes: string;
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
    paymentRemindersEnabled: boolean;
    showInventoryNav: boolean;
    showTeamNav: boolean;
    showContractsNav: boolean;
    cashAppHandle: string | null;
    zelleHandle: string | null;
    venmoHandle: string | null;
    bankTransferNotes: string | null;
    checkPayableTo: string | null;
    paymentInstructionsNotes: string | null;
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
      paymentRemindersEnabled: row.paymentRemindersEnabled,
      showInventoryNav: row.showInventoryNav,
      showTeamNav: row.showTeamNav,
      showContractsNav: row.showContractsNav,
      cashAppHandle: row.cashAppHandle ?? "",
      zelleHandle: row.zelleHandle ?? "",
      venmoHandle: row.venmoHandle ?? "",
      bankTransferNotes: row.bankTransferNotes ?? "",
      checkPayableTo: row.checkPayableTo ?? "",
      paymentInstructionsNotes: row.paymentInstructionsNotes ?? "",
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
        paymentRemindersEnabled: form.paymentRemindersEnabled,
        showInventoryNav: form.showInventoryNav,
        showTeamNav: form.showTeamNav,
        showContractsNav: form.showContractsNav,
        cashAppHandle: form.cashAppHandle,
        zelleHandle: form.zelleHandle,
        venmoHandle: form.venmoHandle,
        bankTransferNotes: form.bankTransferNotes,
        checkPayableTo: form.checkPayableTo,
        paymentInstructionsNotes: form.paymentInstructionsNotes,
      },
    });

    setIsSaving(false);

    if (!result.ok) {
      setMessageIsError(true);
      setMessage(result.data?.message ?? result.message);
      return;
    }

    setMessageIsError(false);
    setMessage("Settings saved.");
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
            placeholder="bpeventsanddesigns@gmail.com"
            type="email"
            value={form.inquiryRecipientEmail}
          />
          <p className="mini-meta" style={{ marginTop: 6 }}>
            Inquiry form notifications go here. The Contact page and Footer display this same address.
          </p>
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
            <label className="check-row">
              <input
                checked={form.paymentRemindersEnabled}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("paymentRemindersEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Automatic payment reminders (default off)</span>
            </label>
          </div>
          <p className="mini-meta" style={{ marginTop: 8 }}>
            Payment reminders email clients about invoices due within 3 days or overdue. At most one reminder per invoice every 3 days.
          </p>
        </div>

        <h2 className="wide" style={{ marginTop: 12 }}>Dashboard menu</h2>
        <p className="mini-meta wide">Hide unfinished areas until you are ready to use them.</p>
        <div className="field wide">
          <div className="checkbox-grid">
            <label className="check-row">
              <input
                checked={form.showInventoryNav}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("showInventoryNav", event.target.checked)}
                type="checkbox"
              />
              <span>Show Inventory in sidebar</span>
            </label>
            <label className="check-row">
              <input
                checked={form.showTeamNav}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("showTeamNav", event.target.checked)}
                type="checkbox"
              />
              <span>Show Team in sidebar</span>
            </label>
            <label className="check-row">
              <input
                checked={form.showContractsNav}
                disabled={!canManageOwnerSettings}
                onChange={(event) => update("showContractsNav", event.target.checked)}
                type="checkbox"
              />
              <span>Show Contracts in sidebar</span>
            </label>
          </div>
          <p className="mini-meta" style={{ marginTop: 8 }}>
            Contracts also hide automatically when you have zero contracts, even if this toggle is on.
          </p>
        </div>

        <h2 className="wide" style={{ marginTop: 12 }}>Offline payment instructions</h2>
        <p className="mini-meta wide">
          Shown on client invoices, PDF downloads, and invoice emails. No online payment gateway — Cash App, Zelle, Venmo, check, or bank transfer only.
        </p>
        <Field label="Cash App">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("cashAppHandle", event.target.value)}
            placeholder="$YourCashtag"
            value={form.cashAppHandle}
          />
        </Field>
        <Field label="Zelle">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("zelleHandle", event.target.value)}
            placeholder="email or phone for Zelle"
            value={form.zelleHandle}
          />
        </Field>
        <Field label="Venmo">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("venmoHandle", event.target.value)}
            placeholder="@YourVenmo"
            value={form.venmoHandle}
          />
        </Field>
        <Field label="Checks payable to">
          <Input
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("checkPayableTo", event.target.value)}
            placeholder="Bridget Pope Designs"
            value={form.checkPayableTo}
          />
        </Field>
        <Field label="Bank transfer notes" wide>
          <Textarea
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("bankTransferNotes", event.target.value)}
            placeholder="Bank name, account details, or ACH notes"
            rows={3}
            value={form.bankTransferNotes}
          />
        </Field>
        <Field label="Other payment notes" wide>
          <Textarea
            disabled={!canManageOwnerSettings}
            onChange={(event) => update("paymentInstructionsNotes", event.target.value)}
            placeholder="Include invoice number in the memo, preferred method, etc."
            rows={3}
            value={form.paymentInstructionsNotes}
          />
        </Field>

        {!canManageOwnerSettings ? <p className="form-error wide">Only the owner account can change business settings.</p> : null}
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

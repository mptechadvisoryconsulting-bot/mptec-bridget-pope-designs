"use client";

import { Copy, Save, Star, Archive } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";
import { defaultInvoiceTemplateConfig, type InvoiceTemplateConfig } from "@/lib/invoices/templates";

type InvoiceTemplateFormProps = {
  mode: "create" | "edit";
  templateId?: string;
  initialName?: string;
  initialConfig?: Partial<InvoiceTemplateConfig> | null;
  isDefault?: boolean;
};

function mergedConfig(config?: Partial<InvoiceTemplateConfig> | null): InvoiceTemplateConfig {
  return { ...defaultInvoiceTemplateConfig, ...(config ?? {}) };
}

export function InvoiceTemplateForm({ mode, templateId, initialName, initialConfig, isDefault }: InvoiceTemplateFormProps) {
  const [name, setName] = useState(initialName ?? "Luxury Event Invoice");
  const [config, setConfig] = useState<InvoiceTemplateConfig>(mergedConfig(initialConfig));
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof InvoiceTemplateConfig>(key: K, value: InvoiceTemplateConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const payload = { name, isDefault: Boolean(isDefault && mode === "create"), config };
    const response =
      mode === "create"
        ? await fetch("/api/admin/invoice-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/invoice-templates/${templateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", name, config }),
          });
    const result = await response.json();

    if (result.success && mode === "create") {
      window.location.href = `/admin/invoice-templates/${result.templateId}`;
      return;
    }

    setMessage(result.success ? "Template saved." : result.message ?? "Unable to save template.");
    setIsSaving(false);
  }

  async function runAction(action: "set_default" | "archive" | "duplicate") {
    if (!templateId) return;
    setIsSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/invoice-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();

    if (result.success && action === "duplicate") {
      window.location.href = `/admin/invoice-templates/${result.templateId}`;
      return;
    }

    setMessage(result.success ? "Template updated." : result.message ?? "Unable to update template.");
    setIsSaving(false);
  }

  const previewInvoice = {
    invoice_number: "INV-20260712-001",
    invoice_type: "deposit",
    description: "Luxury event design services",
    subtotal: 4200,
    tax_amount: 0,
    discount_amount: 200,
    total: 4000,
    amount_paid: 1000,
    balance_due: 3000,
    due_date: "2026-08-15",
    created_at: new Date().toISOString(),
    status: "sent",
    template_snapshot: config,
  };

  return (
    <div className="invoice-preview-grid">
      <form className="panel form-grid" onSubmit={save}>
        <h2 className="wide">Template Settings</h2>
        <label className="field wide">
          <span>Template Name</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Business Name</span>
          <input className="input" value={config.businessName} onChange={(event) => update("businessName", event.target.value)} required />
        </label>
        <label className="field">
          <span>Invoice Title</span>
          <input className="input" value={config.invoiceTitle} onChange={(event) => update("invoiceTitle", event.target.value)} required />
        </label>
        <label className="field">
          <span>Accent Color</span>
          <input className="input" type="color" value={config.accentColor} onChange={(event) => update("accentColor", event.target.value)} />
        </label>
        <label className="field">
          <span>Gold / Secondary</span>
          <input className="input" type="color" value={config.secondaryColor} onChange={(event) => update("secondaryColor", event.target.value)} />
        </label>
        <label className="field wide">
          <span>Logo URL</span>
          <input className="input" value={config.logoUrl ?? ""} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://..." />
        </label>
        <label className="field wide">
          <span>Background Artwork URL</span>
          <input className="input" value={config.backgroundArtworkUrl ?? ""} onChange={(event) => update("backgroundArtworkUrl", event.target.value)} placeholder="https://..." />
        </label>
        <label className="field">
          <span>Artwork Opacity</span>
          <input className="input" max="0.25" min="0" step="0.01" type="number" value={config.backgroundOpacity ?? 0} onChange={(event) => update("backgroundOpacity", Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Bill To Label</span>
          <input className="input" value={config.billToLabel ?? "Bill To"} onChange={(event) => update("billToLabel", event.target.value)} required />
        </label>
        <label className="field wide">
          <span>Payment Terms</span>
          <textarea className="textarea" value={config.paymentTerms} onChange={(event) => update("paymentTerms", event.target.value)} required />
        </label>
        <label className="field wide">
          <span>Footer Note</span>
          <input className="input" value={config.footerNote} onChange={(event) => update("footerNote", event.target.value)} required />
        </label>
        {message ? <p className={message.includes("saved") || message.includes("updated") ? "form-success wide" : "form-error wide"}>{message}</p> : null}
        <div className="topbar-actions wide">
          <Button disabled={isSaving} type="submit"><Save size={16} /> {isSaving ? "Saving..." : "Save Template"}</Button>
          {mode === "edit" ? (
            <>
              <Button disabled={isSaving || isDefault} onClick={() => runAction("set_default")} type="button" variant="light"><Star size={16} /> Set Default</Button>
              <Button disabled={isSaving} onClick={() => runAction("duplicate")} type="button" variant="light"><Copy size={16} /> Duplicate</Button>
              <Button disabled={isSaving || isDefault} onClick={() => runAction("archive")} type="button" variant="light"><Archive size={16} /> Archive</Button>
            </>
          ) : null}
        </div>
      </form>
      <section className="panel invoice-shell">
        <InvoiceDocument
          clientEmail="ashley@example.com"
          clientName="Ashley Johnson"
          invoice={previewInvoice}
          items={[
            { id: "1", title: "Event Design Deposit", description: "Design, planning, and creative direction", quantity: 1, unit_price: 3000, total: 3000 },
            { id: "2", title: "Backdrop and Table Styling", description: "Luxury backdrop, linens, and centerpiece package", quantity: 1, unit_price: 1000, total: 1000 },
          ]}
          projectName="Elegant Garden Wedding"
          venue="Murfreesboro, TN"
        />
      </section>
    </div>
  );
}

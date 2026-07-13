"use client";

import { Archive, Copy, Save, Star, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";
import { defaultInvoiceTemplateConfig, defaultInvoiceVisibleFields, type InvoiceTemplateConfig, type InvoiceVisibleFieldsConfig } from "@/lib/invoices/templates";

type InvoiceTemplateFormProps = {
  mode: "create" | "edit";
  templateId?: string;
  initialName?: string;
  initialConfig?: Partial<InvoiceTemplateConfig> | null;
  isDefault?: boolean;
};

function mergedConfig(config?: Partial<InvoiceTemplateConfig> | null): InvoiceTemplateConfig {
  return {
    ...defaultInvoiceTemplateConfig,
    ...(config ?? {}),
    visibleFields: { ...defaultInvoiceVisibleFields, ...(config?.visibleFields ?? {}) },
  };
}

const READABILITY_WARNING_THRESHOLD = 0.16;

export function InvoiceTemplateForm({ mode, templateId, initialName, initialConfig, isDefault }: InvoiceTemplateFormProps) {
  const [name, setName] = useState(initialName ?? "Luxury Event Invoice");
  const [config, setConfig] = useState<InvoiceTemplateConfig>(mergedConfig(initialConfig));
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);

  function update<K extends keyof InvoiceTemplateConfig>(key: K, value: InvoiceTemplateConfig[K]) {
    setConfig((current) => {
      const next = { ...current, [key]: value };
      if (key === "thankYouText") {
        next.footerNote = (value as string) || defaultInvoiceTemplateConfig.footerNote;
      }
      return next;
    });
  }

  function updateVisibleField(key: keyof InvoiceVisibleFieldsConfig, value: boolean) {
    setConfig((current) => ({
      ...current,
      visibleFields: { ...defaultInvoiceVisibleFields, ...current.visibleFields, [key]: value },
    }));
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>, assetType: "logo" | "background") {
    const file = event.target.files?.[0];
    if (!file) return;

    const setLoading = assetType === "logo" ? setUploadingLogo : setUploadingArtwork;
    setLoading(true);
    setMessage("");

    const body = new FormData();
    body.append("file", file);
    body.append("assetType", assetType);
    if (templateId) body.append("templateId", templateId);

    try {
      const response = await fetch("/api/admin/invoice-template-assets", { method: "POST", body });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? "Unable to upload image.");
        return;
      }

      if (assetType === "logo") {
        update("logoUrl", result.url);
      } else {
        update("backgroundArtworkUrl", result.url);
      }
    } catch {
      setMessage("Unable to upload image. Check your connection and try again.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
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

  const visibleFields = { ...defaultInvoiceVisibleFields, ...config.visibleFields };
  const showReadabilityWarning = Boolean(config.backgroundArtworkUrl) && (config.backgroundOpacity ?? 0) > READABILITY_WARNING_THRESHOLD;

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
    active_version: 1,
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
          <span>Invoice Title</span>
          <input className="input" value={config.invoiceTitle} onChange={(event) => update("invoiceTitle", event.target.value)} required />
        </label>
        <label className="field">
          <span>Business Name</span>
          <input className="input" value={config.businessName} onChange={(event) => update("businessName", event.target.value)} required />
        </label>
        <label className="field wide">
          <span>Business Contact Block</span>
          <textarea
            className="textarea"
            placeholder={"Murfreesboro, TN\n(629) 295-4210\nhello@bridgetpopedesigns.com"}
            value={config.businessContactBlock ?? ""}
            onChange={(event) => update("businessContactBlock", event.target.value)}
          />
        </label>

        <h2 className="wide">Branding</h2>
        <div className="field">
          <span>Logo</span>
          <label className="upload-dropzone">
            <Upload size={16} /> {uploadingLogo ? "Uploading..." : "Upload Logo"}
            <input accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => uploadAsset(event, "logo")} type="file" />
          </label>
          {config.logoUrl ? (
            <div className="upload-preview">
              <img alt="Logo preview" src={config.logoUrl} />
              <button onClick={() => update("logoUrl", null)} type="button">Remove</button>
            </div>
          ) : null}
        </div>
        <div className="field">
          <span>Background Artwork</span>
          <label className="upload-dropzone">
            <Upload size={16} /> {uploadingArtwork ? "Uploading..." : "Upload Artwork"}
            <input accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => uploadAsset(event, "background")} type="file" />
          </label>
          {config.backgroundArtworkUrl ? (
            <div className="upload-preview">
              <img alt="Artwork preview" src={config.backgroundArtworkUrl} />
              <button onClick={() => update("backgroundArtworkUrl", null)} type="button">Remove</button>
            </div>
          ) : null}
        </div>
        <label className="field">
          <span>Artwork Opacity</span>
          <input className="input" max="0.25" min="0" step="0.01" type="number" value={config.backgroundOpacity ?? 0} onChange={(event) => update("backgroundOpacity", Number(event.target.value))} />
          {showReadabilityWarning ? <small className="form-warning">This opacity may reduce text readability. Consider a value below 0.16.</small> : null}
        </label>
        <label className="field">
          <span>Artwork Position</span>
          <select className="input" value={config.artworkPosition ?? "center"} onChange={(event) => update("artworkPosition", event.target.value as InvoiceTemplateConfig["artworkPosition"])}>
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="field">
          <span>Artwork Fit</span>
          <select className="input" value={config.artworkFit ?? "cover"} onChange={(event) => update("artworkFit", event.target.value as InvoiceTemplateConfig["artworkFit"])}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label className="field">
          <span>Accent Color</span>
          <input className="input" type="color" value={config.accentColor} onChange={(event) => update("accentColor", event.target.value)} />
        </label>
        <label className="field">
          <span>Secondary Color</span>
          <input className="input" type="color" value={config.secondaryColor} onChange={(event) => update("secondaryColor", event.target.value)} />
        </label>
        <label className="field">
          <span>Paper Color</span>
          <input className="input" type="color" value={config.paperColor ?? "#ffffff"} onChange={(event) => update("paperColor", event.target.value)} />
        </label>

        <h2 className="wide">Typography</h2>
        <label className="field">
          <span>Title Font</span>
          <input className="input" value={config.titleFontFamily ?? ""} onChange={(event) => update("titleFontFamily", event.target.value)} placeholder="Arial, Helvetica, sans-serif" />
        </label>
        <label className="field">
          <span>Title Size</span>
          <input className="input" max="120" min="24" type="number" value={config.titleFontSize ?? 76} onChange={(event) => update("titleFontSize", Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Title Alignment</span>
          <select className="input" value={config.titleAlignment ?? "left"} onChange={(event) => update("titleAlignment", event.target.value as InvoiceTemplateConfig["titleAlignment"])}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="field">
          <span>Heading Font</span>
          <input className="input" value={config.headingFontFamily ?? ""} onChange={(event) => update("headingFontFamily", event.target.value)} placeholder="Arial, Helvetica, sans-serif" />
        </label>
        <label className="field">
          <span>Body Font</span>
          <input className="input" value={config.bodyFontFamily ?? ""} onChange={(event) => update("bodyFontFamily", event.target.value)} placeholder="Georgia, 'Times New Roman', serif" />
        </label>
        <label className="field">
          <span>Body Text Color</span>
          <input className="input" type="color" value={config.bodyTextColor ?? "#111111"} onChange={(event) => update("bodyTextColor", event.target.value)} />
        </label>

        <h2 className="wide">Labels</h2>
        <label className="field">
          <span>Bill To Label</span>
          <input className="input" value={config.billToLabel ?? ""} onChange={(event) => update("billToLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Invoice # Label</span>
          <input className="input" value={config.invoiceNumberLabel ?? ""} onChange={(event) => update("invoiceNumberLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Invoice Date Label</span>
          <input className="input" value={config.invoiceDateLabel ?? ""} onChange={(event) => update("invoiceDateLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Due Date Label</span>
          <input className="input" value={config.dueDateLabel ?? ""} onChange={(event) => update("dueDateLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Items Column Label</span>
          <input className="input" value={config.itemsColumnLabel ?? ""} onChange={(event) => update("itemsColumnLabel", event.target.value)} />
        </label>
        <label className="field">
          <span>Amount Column Label</span>
          <input className="input" value={config.amountColumnLabel ?? ""} onChange={(event) => update("amountColumnLabel", event.target.value)} />
        </label>
        <label className="field">
          <span>Subtotal Label</span>
          <input className="input" value={config.subtotalLabel ?? ""} onChange={(event) => update("subtotalLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Discount Label</span>
          <input className="input" value={config.discountLabel ?? ""} onChange={(event) => update("discountLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Tax Label</span>
          <input className="input" value={config.taxLabel ?? ""} onChange={(event) => update("taxLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Amount Paid Label</span>
          <input className="input" value={config.amountPaidLabel ?? ""} onChange={(event) => update("amountPaidLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Balance Due Label</span>
          <input className="input" value={config.balanceDueLabel ?? ""} onChange={(event) => update("balanceDueLabel", event.target.value)} required />
        </label>
        <label className="field">
          <span>Total Label</span>
          <input className="input" value={config.totalLabel ?? ""} onChange={(event) => update("totalLabel", event.target.value)} required />
        </label>

        <h2 className="wide">Footer & Terms</h2>
        <label className="field wide">
          <span>Thank You Text</span>
          <input className="input" value={config.thankYouText ?? config.footerNote} onChange={(event) => update("thankYouText", event.target.value)} required />
        </label>
        <label className="field">
          <span>Terms Heading</span>
          <input className="input" value={config.termsHeading ?? "Terms & Conditions"} onChange={(event) => update("termsHeading", event.target.value)} required />
        </label>
        <label className="field wide">
          <span>Default Payment Terms</span>
          <textarea className="textarea" value={config.paymentTerms} onChange={(event) => update("paymentTerms", event.target.value)} required />
        </label>
        <label className="field wide">
          <span>Footer Text</span>
          <input className="input" value={config.footerText ?? ""} onChange={(event) => update("footerText", event.target.value)} placeholder="Optional additional footer disclaimer" />
        </label>

        <h2 className="wide">Layout</h2>
        <label className="field">
          <span>Separator Thickness</span>
          <input className="input" max="8" min="0" type="number" value={config.separatorThickness ?? 2} onChange={(event) => update("separatorThickness", Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Separator Style</span>
          <select className="input" value={config.separatorStyle ?? "solid"} onChange={(event) => update("separatorStyle", event.target.value as InvoiceTemplateConfig["separatorStyle"])}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
        <label className="field">
          <span>Line Item Spacing</span>
          <input className="input" max="40" min="4" type="number" value={config.lineItemSpacing ?? 16} onChange={(event) => update("lineItemSpacing", Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Footer Alignment</span>
          <select className="input" value={config.footerAlignment ?? "right"} onChange={(event) => update("footerAlignment", event.target.value as InvoiceTemplateConfig["footerAlignment"])}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="check-row">
          <input checked={config.footerSeparator !== false} onChange={(event) => update("footerSeparator", event.target.checked)} type="checkbox" />
          <span>Show footer separator line</span>
        </label>

        <h2 className="wide">Visible Fields</h2>
        <div className="checkbox-grid wide">
          <label className="check-row">
            <input checked={visibleFields.discount} onChange={(event) => updateVisibleField("discount", event.target.checked)} type="checkbox" />
            <span>Discount</span>
          </label>
          <label className="check-row">
            <input checked={visibleFields.tax} onChange={(event) => updateVisibleField("tax", event.target.checked)} type="checkbox" />
            <span>Tax</span>
          </label>
          <label className="check-row">
            <input checked={visibleFields.amountPaid} onChange={(event) => updateVisibleField("amountPaid", event.target.checked)} type="checkbox" />
            <span>Amount Paid</span>
          </label>
          <label className="check-row">
            <input checked={visibleFields.dueDate} onChange={(event) => updateVisibleField("dueDate", event.target.checked)} type="checkbox" />
            <span>Due Date</span>
          </label>
          <label className="check-row">
            <input checked={visibleFields.project} onChange={(event) => updateVisibleField("project", event.target.checked)} type="checkbox" />
            <span>Project Name</span>
          </label>
          <label className="check-row">
            <input checked={visibleFields.venue} onChange={(event) => updateVisibleField("venue", event.target.checked)} type="checkbox" />
            <span>Venue</span>
          </label>
        </div>

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
          clientEmail="sample@example.com"
          clientName="Sample Client"
          invoice={previewInvoice}
          items={[
            { id: "1", title: "Event Design Deposit", description: "Design, planning, and creative direction", quantity: 1, unit_price: 3000, total: 3000 },
            { id: "2", title: "Backdrop and Table Styling", description: "Luxury backdrop, linens, and centerpiece package", quantity: 1, unit_price: 1000, total: 1000 },
          ]}
          previewBadge="TEMPLATE PREVIEW"
          projectName="Sample Event"
          venue="Sample Venue"
        />
      </section>
    </div>
  );
}

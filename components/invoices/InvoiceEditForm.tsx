"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-calculations";

type TemplateOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type LineItem = {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function numberFromInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InvoiceEditForm({
  invoiceId,
  isDraft,
  templates,
  initialTemplateId,
  initialInvoiceType,
  initialDescription,
  initialDueDate,
  initialTaxAmount,
  initialDiscountAmount,
  initialItems,
  initialAccentColor,
  initialPaymentTerms,
  initialFooterNote,
}: {
  invoiceId: string;
  isDraft: boolean;
  templates: TemplateOption[];
  initialTemplateId: string;
  initialInvoiceType: string;
  initialDescription: string;
  initialDueDate: string;
  initialTaxAmount: number;
  initialDiscountAmount: number;
  initialItems: LineItem[];
  initialAccentColor: string;
  initialPaymentTerms?: string;
  initialFooterNote?: string;
}) {
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [invoiceType, setInvoiceType] = useState(initialInvoiceType);
  const [description, setDescription] = useState(initialDescription);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [paymentTerms, setPaymentTerms] = useState(initialPaymentTerms ?? "");
  const [footerNote, setFooterNote] = useState(initialFooterNote ?? "");
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [items, setItems] = useState<LineItem[]>(initialItems.length ? initialItems : [{ title: "", description: "", quantity: "1", unitPrice: "0.00" }]);
  const [taxAmount, setTaxAmount] = useState(initialTaxAmount.toFixed(2));
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount.toFixed(2));
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totals = calculateInvoiceTotals(
    items.map((item) => ({
      title: item.title,
      quantity: numberFromInput(item.quantity),
      unitPrice: numberFromInput(item.unitPrice),
    })),
    numberFromInput(taxAmount),
    numberFromInput(discountAmount),
  );

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        templateOverrides: { accentColor, paymentTerms, footerNote },
        invoiceType,
        description,
        dueDate,
        taxAmount: numberFromInput(taxAmount),
        discountAmount: numberFromInput(discountAmount),
        items: items.map((item) => ({
          title: item.title,
          description: item.description || undefined,
          quantity: numberFromInput(item.quantity),
          unitPrice: numberFromInput(item.unitPrice),
        })),
      }),
    });

    const payload = await response.json();
    if (payload.success) {
      window.location.href = `/admin/invoices/${invoiceId}`;
      return;
    }

    setMessage(payload.message ?? "Unable to update invoice.");
    setIsSubmitting(false);
  }

  return (
    <form className="panel invoice-builder span-2" onSubmit={submitEdit}>
      <h2>{isDraft ? "Edit Draft Invoice" : "Revise Invoice"}</h2>
      {!isDraft ? (
        <p className="mini-meta invoice-version-banner">
          This invoice has already been sent. Saving will create a new immutable version, preserve the previous version&apos;s
          snapshot and template for history, and set this revision as the active version. Resend the invoice afterward to
          notify the client of the update.
        </p>
      ) : null}
      <div className="form-grid">
        <label className="field">
          <span>Invoice Type</span>
          <select className="input" value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)}>
            <option value="deposit">Deposit</option>
            <option value="installment">Installment</option>
            <option value="final">Final</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="field">
          <span>Invoice Template</span>
          <select className="input" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " (default)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Due Date</span>
          <input className="input" required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Tax</span>
          <input className="input" min="0" step="0.01" type="number" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />
        </label>
        <label className="field">
          <span>Discount</span>
          <input className="input" min="0" step="0.01" type="number" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
        </label>
        <label className="field wide">
          <span>Invoice Notes</span>
          <textarea className="textarea" required value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="field wide">
          <span>Payment Terms Override</span>
          <textarea className="textarea" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="Leave blank to use the reusable template terms." />
        </label>
        <label className="field">
          <span>Accent Color</span>
          <input className="input" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
        </label>
        <label className="field">
          <span>Footer Note Override</span>
          <input className="input" value={footerNote} onChange={(event) => setFooterNote(event.target.value)} placeholder="Optional invoice note" />
        </label>
      </div>

      <div className="invoice-lines">
        <div className="invoice-line-grid invoice-line-head">
          <span>Item</span>
          <span>Description</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Total</span>
          <span />
        </div>
        {items.map((item, index) => (
          <div className="invoice-line-grid" key={index}>
            <input className="input" required value={item.title} onChange={(event) => updateItem(index, "title", event.target.value)} placeholder="Luxury backdrop" />
            <input className="input" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Optional notes" />
            <input className="input" min="0.01" step="0.01" type="number" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} />
            <input className="input" min="0" step="0.01" type="number" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} />
            <strong>{currency(totals.items[index]?.total ?? 0)}</strong>
            <button aria-label="Remove item" className="icon-btn" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="invoice-actions">
        <Button onClick={() => setItems((current) => [...current, { title: "", description: "", quantity: "1", unitPrice: "0.00" }])} type="button" variant="light">
          <Plus size={16} /> Add Line Item
        </Button>
        <div className="invoice-total">
          <span>Subtotal {currency(totals.subtotal)}</span>
          <span>Tax {currency(totals.taxAmount)}</span>
          <span>Discount {currency(totals.discountAmount)}</span>
          <strong>Total {currency(totals.total)}</strong>
        </div>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : isDraft ? "Save Draft" : "Save as New Version"}
      </Button>
    </form>
  );
}

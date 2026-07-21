"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-calculations";

type ClientOption = {
  id: string;
  name: string;
  username: string;
};

type ProjectOption = {
  id: string;
  clientId: string;
  name: string;
  status: string;
};

type ProposalOption = {
  id: string;
  projectId: string;
  label: string;
};

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

const emptyItem: LineItem = {
  title: "",
  description: "",
  quantity: "1",
  unitPrice: "0.00",
};

function numberFromInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InvoiceCreateForm({
  clients,
  projects,
  proposals,
  templates,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  proposals: ProposalOption[];
  templates: TemplateOption[];
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const filteredProjects = useMemo(() => projects.filter((project) => project.clientId === clientId), [clientId, projects]);
  const [projectId, setProjectId] = useState(filteredProjects[0]?.id ?? "");
  const [proposalId, setProposalId] = useState("");
  const [invoiceType, setInvoiceType] = useState("deposit");
  const [templateId, setTemplateId] = useState(templates.find((template) => template.isDefault)?.id ?? templates[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [accentColor, setAccentColor] = useState("#c96f82");
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [taxAmount, setTaxAmount] = useState("0.00");
  const [discountAmount, setDiscountAmount] = useState("0.00");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveProjectId = filteredProjects.some((project) => project.id === projectId) ? projectId : filteredProjects[0]?.id ?? "";
  const filteredProposals = proposals.filter((proposal) => proposal.projectId === effectiveProjectId);
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

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        projectId: effectiveProjectId,
        proposalId,
        templateId,
        templateOverrides: {
          accentColor,
          paymentTerms,
          footerNote,
        },
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
      window.location.href = `/admin/invoices/${payload.invoice.id}`;
      return;
    }

    setMessage(payload.message ?? "Unable to create invoice.");
    setIsSubmitting(false);
  }

  return (
    <form className="panel invoice-builder" onSubmit={submitInvoice}>
      <h2>Create Invoice</h2>
      <div className="form-grid">
        <label className="field">
          <span>Client</span>
          <select className="input" required value={clientId} onChange={(event) => {
            const nextClient = event.target.value;
            const nextProject = projects.find((project) => project.clientId === nextClient)?.id ?? "";
            setClientId(nextClient);
            setProjectId(nextProject);
            setProposalId("");
          }}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name} ({client.username})</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Project</span>
          <select className="input" required value={effectiveProjectId} onChange={(event) => {
            setProjectId(event.target.value);
            setProposalId("");
          }}>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.name} - {project.status.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
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
          <span>Proposal</span>
          <select className="input" value={proposalId} onChange={(event) => setProposalId(event.target.value)}>
            <option value="">No proposal attached</option>
            {filteredProposals.map((proposal) => (
              <option key={proposal.id} value={proposal.id}>{proposal.label}</option>
            ))}
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
          <textarea className="textarea" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Deposit for event design services." />
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
            <button className="icon-btn" type="button" aria-label="Remove item" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="invoice-actions">
        <Button type="button" variant="light" onClick={() => setItems((current) => [...current, { ...emptyItem }])}>
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
      <Button disabled={isSubmitting || !clients.length || !effectiveProjectId} type="submit">
        {isSubmitting ? "Creating Invoice..." : "Create Invoice"}
      </Button>
    </form>
  );
}

import { normalizeInvoiceTemplateConfig, type InvoiceTemplateConfig, type InvoiceVisibleFieldsConfig } from "@/lib/invoices/templates";

export type InvoiceRenderItemInput = {
  id?: string;
  title?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  unitPrice?: number | string | null;
  total?: number | string | null;
};

export type InvoiceRenderItem = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceRenderModel = {
  invoiceNumber: string;
  invoiceType: string;
  description: string | null;
  status: string;
  issueDateISO: string;
  issueDateLabel: string;
  dueDateISO: string | null;
  dueDateLabel: string | null;
  versionNumber: number;
  isUpdatedVersion: boolean;
  client: { name: string; email: string | null };
  project: { name: string | null; venue: string | null };
  items: InvoiceRenderItem[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    amountPaid: number;
    balanceDue: number;
    total: number;
  };
  template: InvoiceTemplateConfig;
  flags: {
    showDiscount: boolean;
    showTax: boolean;
    showAmountPaid: boolean;
    showDueDate: boolean;
    showProject: boolean;
    showVenue: boolean;
  };
};

export type InvoiceRenderModelInput = {
  invoice: {
    invoice_number: string;
    invoice_type?: string | null;
    description?: string | null;
    subtotal?: number | string | null;
    tax_amount?: number | string | null;
    discount_amount?: number | string | null;
    total?: number | string | null;
    amount_paid?: number | string | null;
    balance_due?: number | string | null;
    due_date?: string | null;
    created_at?: string | null;
    status?: string | null;
    active_version?: number | string | null;
    template_snapshot?: unknown;
  };
  items: InvoiceRenderItemInput[];
  clientName: string;
  clientEmail?: string | null;
  projectName?: string | null;
  venue?: string | null;
  versionNumber?: number | null;
};

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function buildInvoiceRenderModel(input: InvoiceRenderModelInput): InvoiceRenderModel {
  const { invoice, items, clientName, clientEmail, projectName, venue } = input;
  const template = normalizeInvoiceTemplateConfig(invoice.template_snapshot as InvoiceTemplateConfig | null);
  const visibleFields = template.visibleFields as InvoiceVisibleFieldsConfig;

  const subtotal = num(invoice.subtotal);
  const discount = num(invoice.discount_amount);
  const tax = num(invoice.tax_amount);
  const amountPaid = num(invoice.amount_paid);
  const total = num(invoice.total);
  const balanceDue = num(invoice.balance_due);

  const versionNumber = Number(input.versionNumber ?? invoice.active_version ?? 1) || 1;

  const renderItems: InvoiceRenderItem[] = (items ?? []).map((item, index) => {
    const quantity = num(item.quantity ?? 1) || 1;
    const unitPrice = num(item.unit_price ?? item.unitPrice);
    return {
      id: item.id ?? String(index),
      title: item.title ?? "Line item",
      description: item.description ?? null,
      quantity,
      unitPrice,
      total: item.total !== undefined && item.total !== null ? num(item.total) : Number((quantity * unitPrice).toFixed(2)),
    };
  });

  const issueDateISO = invoice.created_at ?? new Date().toISOString();

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceType: invoice.invoice_type ?? "custom",
    description: invoice.description ?? null,
    status: invoice.status ?? "pending",
    issueDateISO,
    issueDateLabel: formatDate(issueDateISO) ?? new Date().toLocaleDateString("en-US"),
    dueDateISO: invoice.due_date ?? null,
    dueDateLabel: formatDate(invoice.due_date),
    versionNumber,
    isUpdatedVersion: versionNumber > 1,
    client: { name: clientName, email: clientEmail ?? null },
    project: { name: projectName ?? null, venue: venue ?? null },
    items: renderItems,
    totals: { subtotal, discount, tax, amountPaid, balanceDue, total },
    template,
    flags: {
      showDiscount: visibleFields.discount && discount > 0,
      showTax: visibleFields.tax && tax > 0,
      showAmountPaid: visibleFields.amountPaid && amountPaid > 0,
      showDueDate: visibleFields.dueDate && Boolean(invoice.due_date),
      showProject: visibleFields.project && Boolean(projectName),
      showVenue: visibleFields.venue && Boolean(venue),
    },
  };
}

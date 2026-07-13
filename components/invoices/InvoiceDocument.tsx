import { currency } from "@/lib/currency";

export type InvoiceDocumentItem = {
  id: string;
  title: string;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total?: number | string | null;
};

export type InvoiceDocumentData = {
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
  template_snapshot?: unknown;
};

type TemplateSnapshot = {
  businessName?: string;
  invoiceTitle?: string;
  accentColor?: string;
  secondaryColor?: string;
  paymentTerms?: string;
  footerNote?: string;
  logoUrl?: string | null;
  backgroundArtworkUrl?: string | null;
  backgroundOpacity?: number;
  billToLabel?: string;
  invoiceNumberLabel?: string;
  invoiceDateLabel?: string;
  dueDateLabel?: string;
  subtotalLabel?: string;
  discountLabel?: string;
  taxLabel?: string;
  amountPaidLabel?: string;
  balanceDueLabel?: string;
  totalLabel?: string;
};

function invoiceTemplate(snapshot: unknown): TemplateSnapshot {
  return snapshot && typeof snapshot === "object" ? (snapshot as TemplateSnapshot) : {};
}

export function InvoiceDocument({
  invoice,
  items,
  clientName,
  clientEmail,
  projectName,
  venue,
}: {
  invoice: InvoiceDocumentData;
  items: InvoiceDocumentItem[];
  clientName: string;
  clientEmail?: string | null;
  projectName?: string | null;
  venue?: string | null;
}) {
  const issueDate = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("en-US") : new Date().toLocaleDateString("en-US");
  const subtotal = Number(invoice.subtotal ?? 0);
  const discount = Number(invoice.discount_amount ?? 0);
  const tax = Number(invoice.tax_amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const balance = Number(invoice.balance_due ?? 0);
  const total = Number(invoice.total ?? 0);
  const template = invoiceTemplate(invoice.template_snapshot);
  const accentColor = template.accentColor ?? "#c96f82";
  const secondaryColor = template.secondaryColor ?? "#d9af6f";

  return (
    <article
      className="invoice-document"
      aria-label={`Invoice ${invoice.invoice_number}`}
      style={{
        ["--invoice-accent" as string]: accentColor,
        ["--invoice-secondary" as string]: secondaryColor,
        ["--invoice-art-opacity" as string]: String(template.backgroundOpacity ?? 0.06),
      }}
    >
      {template.backgroundArtworkUrl ? <div className="invoice-artwork" style={{ backgroundImage: `url(${template.backgroundArtworkUrl})` }} /> : null}
      <div className="invoice-doc-content">
        <header className="invoice-doc-header">
          <div>
            {template.logoUrl ? <img alt="" className="invoice-logo" src={template.logoUrl} /> : null}
            <h1>{template.invoiceTitle ?? "Invoice"}</h1>
            <strong>{template.businessName ?? "Bridget Pope Designs"}</strong>
          </div>
          <span className="invoice-status">{invoice.status ?? "pending"}</span>
        </header>

        <section className="invoice-doc-meta">
          <div>
            <h2>{template.billToLabel ?? "Bill To"}</h2>
            <p>{clientName}</p>
            {clientEmail ? <p>{clientEmail}</p> : null}
            {projectName ? <p>{projectName}</p> : null}
            {venue ? <p>{venue}</p> : null}
          </div>
          <dl>
            <div><dt>{template.invoiceNumberLabel ?? "Invoice #"}</dt><dd>{invoice.invoice_number}</dd></div>
            <div><dt>{template.invoiceDateLabel ?? "Invoice Date"}</dt><dd>{issueDate}</dd></div>
            {invoice.due_date ? <div><dt>{template.dueDateLabel ?? "Due Date"}</dt><dd>{invoice.due_date}</dd></div> : null}
          </dl>
        </section>

        <table className="invoice-doc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                  <small>
                    {Number(item.quantity ?? 1)} x {currency(Number(item.unit_price ?? 0))}
                  </small>
                </td>
                <td>{currency(Number(item.total ?? 0))}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={2}>No line items were added to this invoice.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <section className="invoice-doc-summary" aria-label="Invoice totals">
          <div><span>{template.subtotalLabel ?? "Subtotal"}</span><strong>{currency(subtotal)}</strong></div>
          {discount > 0 ? <div><span>{template.discountLabel ?? "Discount"}</span><strong>{currency(discount)}</strong></div> : null}
          {tax > 0 ? <div><span>{template.taxLabel ?? "Tax"}</span><strong>{currency(tax)}</strong></div> : null}
          {paid > 0 ? <div><span>{template.amountPaidLabel ?? "Amount Paid"}</span><strong>{currency(paid)}</strong></div> : null}
          <div><span>{template.balanceDueLabel ?? "Balance Due"}</span><strong>{currency(balance)}</strong></div>
          <div className="invoice-doc-total"><span>{template.totalLabel ?? "Total"}</span><strong>{currency(total)}</strong></div>
        </section>

        <footer className="invoice-doc-footer">
          <div className="invoice-thanks">{template.footerNote ?? "Thank you"}</div>
          <div className="invoice-terms">
            <h2>Terms & Conditions</h2>
            <p>{template.paymentTerms ?? "Payment is due within 15 days."}</p>
          </div>
        </footer>
      </div>
    </article>
  );
}

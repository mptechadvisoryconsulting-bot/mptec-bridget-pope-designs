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
};

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

  return (
    <article className="invoice-document" aria-label={`Invoice ${invoice.invoice_number}`}>
      <header className="invoice-doc-header">
        <div>
          <h1>Invoice</h1>
          <strong>Bridget Pope Designs</strong>
        </div>
        <span className="invoice-status">{invoice.status ?? "pending"}</span>
      </header>

      <section className="invoice-doc-meta">
        <div>
          <h2>Bill To</h2>
          <p>{clientName}</p>
          {clientEmail ? <p>{clientEmail}</p> : null}
          {projectName ? <p>{projectName}</p> : null}
          {venue ? <p>{venue}</p> : null}
        </div>
        <dl>
          <div><dt>Invoice #</dt><dd>{invoice.invoice_number}</dd></div>
          <div><dt>Invoice Date</dt><dd>{issueDate}</dd></div>
          {invoice.due_date ? <div><dt>Due Date</dt><dd>{invoice.due_date}</dd></div> : null}
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
        <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
        {discount > 0 ? <div><span>Discount</span><strong>{currency(discount)}</strong></div> : null}
        {tax > 0 ? <div><span>Tax</span><strong>{currency(tax)}</strong></div> : null}
        {paid > 0 ? <div><span>Amount Paid</span><strong>{currency(paid)}</strong></div> : null}
        <div><span>Balance Due</span><strong>{currency(balance)}</strong></div>
        <div className="invoice-doc-total"><span>Total</span><strong>{currency(total)}</strong></div>
      </section>

      <footer className="invoice-doc-footer">
        <div className="invoice-thanks">Thank you</div>
        <div className="invoice-terms">
          <h2>Terms & Conditions</h2>
          <p>Payment is due within 15 days.</p>
        </div>
      </footer>
    </article>
  );
}

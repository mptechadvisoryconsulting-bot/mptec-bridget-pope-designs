import { currency } from "@/lib/currency";
import { buildInvoiceRenderModel, type InvoiceRenderItemInput, type InvoiceRenderModel } from "@/lib/invoices/render-model";

export type InvoiceDocumentItem = InvoiceRenderItemInput & { id: string };

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
  active_version?: number | string | null;
  template_snapshot?: unknown;
};

/**
 * Renders an invoice using the shared InvoiceRenderModel so that browser preview,
 * print, PDF download, and email attachment can never diverge on financial values.
 */
export function InvoiceDocument({
  invoice,
  items,
  clientName,
  clientEmail,
  projectName,
  venue,
  previewBadge,
}: {
  invoice: InvoiceDocumentData;
  items: InvoiceDocumentItem[];
  clientName: string;
  clientEmail?: string | null;
  projectName?: string | null;
  venue?: string | null;
  previewBadge?: string;
}) {
  const model = buildInvoiceRenderModel({
    invoice,
    items,
    clientName,
    clientEmail,
    projectName,
    venue,
  });

  return <InvoiceDocumentFromModel model={model} previewBadge={previewBadge} />;
}

export function InvoiceDocumentFromModel({ model, previewBadge }: { model: InvoiceRenderModel; previewBadge?: string }) {
  const { template, totals, flags } = model;
  const separatorStyle = template.separatorStyle ?? "solid";
  const separatorThickness = template.separatorThickness ?? 2;
  const lineItemSpacing = template.lineItemSpacing ?? 16;

  return (
    <article
      aria-label={`Invoice ${model.invoiceNumber}`}
      className="invoice-document"
      style={{
        ["--invoice-accent" as string]: template.accentColor,
        ["--invoice-secondary" as string]: template.secondaryColor,
        ["--invoice-paper" as string]: template.paperColor ?? "#ffffff",
        ["--invoice-body-color" as string]: template.bodyTextColor ?? "#111111",
        ["--invoice-body-font" as string]: template.bodyFontFamily ?? "Georgia, 'Times New Roman', serif",
        ["--invoice-heading-font" as string]: template.headingFontFamily ?? "Arial, Helvetica, sans-serif",
        ["--invoice-title-font" as string]: template.titleFontFamily ?? "Arial, Helvetica, sans-serif",
        ["--invoice-title-size" as string]: `${template.titleFontSize ?? 76}px`,
        ["--invoice-art-opacity" as string]: String(template.backgroundOpacity ?? 0.06),
        ["--invoice-separator-thickness" as string]: `${separatorThickness}px`,
        ["--invoice-separator-style" as string]: separatorStyle,
        ["--invoice-line-spacing" as string]: `${lineItemSpacing}px`,
        background: template.paperColor ?? "#ffffff",
      }}
    >
      <p className="invoice-scroll-hint">Scroll for full invoice</p>
      {previewBadge ? <div className="invoice-preview-badge">{previewBadge}</div> : null}
      {template.backgroundArtworkUrl ? (
        <div
          className="invoice-artwork"
          style={{
            backgroundImage: `url(${template.backgroundArtworkUrl})`,
            backgroundPosition: template.artworkPosition ?? "center",
            backgroundSize: template.artworkFit ?? "cover",
          }}
        />
      ) : null}
      <div className="invoice-doc-content">
        <header className="invoice-doc-header">
          <div>
            {template.logoUrl ? <img alt="" className="invoice-logo" src={template.logoUrl} /> : null}
            <h1 style={{ textAlign: template.titleAlignment ?? "left" }}>{template.invoiceTitle}</h1>
            <strong>{template.businessName}</strong>
            {template.businessContactBlock ? (
              <address className="invoice-business-contact">
                {template.businessContactBlock.split("\n").map((line, index) => (
                  <span key={index}>{line}</span>
                ))}
              </address>
            ) : null}
          </div>
          <span className="invoice-status">
            {model.status}
            {model.isUpdatedVersion ? <em> &middot; v{model.versionNumber}</em> : null}
          </span>
        </header>

        <section className="invoice-doc-meta">
          <div>
            <h2>{template.billToLabel}</h2>
            <p>{model.client.name}</p>
            {model.client.email ? <p>{model.client.email}</p> : null}
            {flags.showProject ? <p>{model.project.name}</p> : null}
            {flags.showVenue ? <p>{model.project.venue}</p> : null}
          </div>
          <dl>
            <div>
              <dt>{template.invoiceNumberLabel}</dt>
              <dd>{model.invoiceNumber}</dd>
            </div>
            <div>
              <dt>{template.invoiceDateLabel}</dt>
              <dd>{model.issueDateLabel}</dd>
            </div>
            {flags.showDueDate ? (
              <div>
                <dt>{template.dueDateLabel}</dt>
                <dd>{model.dueDateLabel}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <table className="invoice-doc-table">
          <thead>
            <tr>
              <th>{template.itemsColumnLabel ?? "Description"}</th>
              <th>{template.amountColumnLabel ?? "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {model.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                  <small>
                    {item.quantity} x {currency(item.unitPrice)}
                  </small>
                </td>
                <td>{currency(item.total)}</td>
              </tr>
            ))}
            {!model.items.length ? (
              <tr>
                <td colSpan={2}>No line items were added to this invoice.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <section aria-label="Invoice totals" className="invoice-doc-summary">
          <div>
            <span>{template.subtotalLabel}</span>
            <strong>{currency(totals.subtotal)}</strong>
          </div>
          {flags.showDiscount ? (
            <div>
              <span>{template.discountLabel}</span>
              <strong>{currency(totals.discount)}</strong>
            </div>
          ) : null}
          {flags.showTax ? (
            <div>
              <span>{template.taxLabel}</span>
              <strong>{currency(totals.tax)}</strong>
            </div>
          ) : null}
          {flags.showAmountPaid ? (
            <div>
              <span>{template.amountPaidLabel}</span>
              <strong>{currency(totals.amountPaid)}</strong>
            </div>
          ) : null}
          <div>
            <span>{template.balanceDueLabel}</span>
            <strong>{currency(totals.balanceDue)}</strong>
          </div>
          <div className="invoice-doc-total">
            <span>{template.totalLabel}</span>
            <strong>{currency(totals.total)}</strong>
          </div>
        </section>

        <footer className={`invoice-doc-footer invoice-footer-align-${template.footerAlignment ?? "right"}${template.footerSeparator === false ? " invoice-footer-no-separator" : ""}`}>
          <div className="invoice-thanks">{template.thankYouText}</div>
          <div className="invoice-terms">
            <h2>{template.termsHeading ?? "Terms & Conditions"}</h2>
            <p>{template.paymentTerms}</p>
            {template.footerText ? <p className="invoice-footer-text">{template.footerText}</p> : null}
          </div>
        </footer>
      </div>
    </article>
  );
}

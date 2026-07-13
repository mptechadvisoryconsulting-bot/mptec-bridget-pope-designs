import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";

export function PaymentCard({
  balanceDue = 0,
  dueDate,
  status,
  invoiceId,
  invoiceUrl = "/client/invoices",
  pdfUrl,
}: {
  balanceDue?: number;
  dueDate?: string | null;
  status?: string | null;
  invoiceId?: string | null;
  invoiceUrl?: string;
  pdfUrl?: string | null;
}) {
  const viewHref = invoiceId ? `/client/invoices/${invoiceId}` : invoiceUrl;
  const downloadHref = pdfUrl ?? (invoiceId ? `/api/invoices/${invoiceId}/pdf` : null);

  return (
    <section className="panel">
      <h2>Current Invoice</h2>
      <span className="mini-meta">Balance Due</span>
      <strong style={{ display: "block", fontSize: 28, margin: "6px 0" }}>{currency(balanceDue)}</strong>
      <p className="mini-meta">Due by {dueDate ?? "No open invoice"}</p>
      {status ? (
        <p className="mini-meta" style={{ marginTop: 0 }}>
          Status: <span className="status">{status.replace(/_/g, " ")}</span>
        </p>
      ) : null}
      <div className="topbar-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
        <ButtonLink href={viewHref}>{invoiceId ? "View Invoice" : "View Invoices"}</ButtonLink>
        {downloadHref ? (
          <ButtonLink href={downloadHref} variant="light">
            Download PDF
          </ButtonLink>
        ) : null}
      </div>
      <p className="mini-meta" style={{ marginBottom: 0, marginTop: 10 }}>
        Payment arrangements are handled directly with Bridget Pope Designs. Your balance updates when a payment is recorded.
      </p>
    </section>
  );
}

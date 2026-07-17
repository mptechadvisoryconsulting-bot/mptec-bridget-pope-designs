import { Download } from "lucide-react";

export function DownloadInvoicePdfButton({ invoiceId }: { invoiceId: string }) {
  return (
    <a className="btn btn-light" download href={`/api/invoices/${invoiceId}/pdf`}>
      <Download size={16} /> Download PDF
    </a>
  );
}

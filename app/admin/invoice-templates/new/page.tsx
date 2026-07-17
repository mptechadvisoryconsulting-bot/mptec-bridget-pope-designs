import { InvoiceTemplateForm } from "@/components/invoices/InvoiceTemplateForm";
import { defaultInvoiceTemplateConfig } from "@/lib/invoices/templates";

export default function NewInvoiceTemplatePage() {
  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Billing Design</span>
          <h1>New Invoice Template</h1>
          <p className="mini-meta">Create a reusable invoice design with a live print preview.</p>
        </div>
      </div>
      <InvoiceTemplateForm mode="create" initialConfig={defaultInvoiceTemplateConfig} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { InvoiceEditForm } from "@/components/invoices/InvoiceEditForm";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const nonEditableStatuses = new Set(["paid", "cancelled", "refunded", "partially_refunded"]);

export default async function AdminInvoiceEditPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = createAdminClient();

  const [{ data: invoice }, { data: templates }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, bpd_invoice_items(*), bpd_clients(bpd_profiles(first_name,last_name,email))")
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase.from("invoice_templates").select("id,name,is_default").order("is_default", { ascending: false }),
  ]);

  if (!invoice) notFound();
  if (nonEditableStatuses.has(invoice.status)) notFound();

  const templateOptions = (templates ?? []).map((template) => ({ id: template.id, name: template.name, isDefault: template.is_default }));
  const templateSnapshot = (invoice.template_snapshot ?? {}) as { accentColor?: string; paymentTerms?: string; footerNote?: string };
  const items = (invoice.bpd_invoice_items ?? []).map((item: { title: string; description?: string | null; quantity: number; unit_price: number }) => ({
    title: item.title,
    description: item.description ?? "",
    quantity: String(item.quantity ?? 1),
    unitPrice: String(item.unit_price ?? 0),
  }));

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Billing</span>
          <h1>{invoice.invoice_number}</h1>
        </div>
      </div>
      <div className="dashboard-grid">
        <InvoiceEditForm
          initialAccentColor={invoice.template_overrides?.accentColor ?? templateSnapshot.accentColor ?? "#c96f82"}
          initialDescription={invoice.description ?? ""}
          initialDiscountAmount={Number(invoice.discount_amount ?? 0)}
          initialDueDate={invoice.due_date ?? ""}
          initialFooterNote={invoice.template_overrides?.footerNote ?? ""}
          initialInvoiceType={invoice.invoice_type ?? "custom"}
          initialItems={items}
          initialPaymentTerms={invoice.template_overrides?.paymentTerms ?? ""}
          initialTaxAmount={Number(invoice.tax_amount ?? 0)}
          initialTemplateId={invoice.template_id ?? templateOptions.find((template) => template.isDefault)?.id ?? ""}
          invoiceId={invoice.id}
          isDraft={invoice.status === "draft"}
          templates={templateOptions}
        />
      </div>
    </div>
  );
}

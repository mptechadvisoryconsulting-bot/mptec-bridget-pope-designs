import { notFound } from "next/navigation";
import { InvoiceTemplateForm } from "@/components/invoices/InvoiceTemplateForm";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceTemplateConfig } from "@/lib/invoices/templates";

export default async function InvoiceTemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const { data: template } = await createAdminClient()
    .from("invoice_templates")
    .select("id,name,is_default,config")
    .eq("id", templateId)
    .maybeSingle();

  if (!template) notFound();

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Billing Design</span>
          <h1>{template.name}</h1>
          <p className="mini-meta">Edit reusable invoice branding and preview the exact render model used by invoice pages.</p>
        </div>
      </div>
      <InvoiceTemplateForm
        mode="edit"
        templateId={template.id}
        initialName={template.name}
        initialConfig={template.config as Partial<InvoiceTemplateConfig>}
        isDefault={template.is_default}
      />
    </div>
  );
}

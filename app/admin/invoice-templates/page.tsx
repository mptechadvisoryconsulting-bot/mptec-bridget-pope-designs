import { ButtonLink } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  name: string;
  is_default: boolean;
  updated_at?: string | null;
  config?: { accentColor?: string; secondaryColor?: string; businessName?: string } | null;
};

export default async function InvoiceTemplatesPage() {
  const { data } = await createAdminClient()
    .from("invoice_templates")
    .select("id,name,is_default,updated_at,config")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  const templates = (data ?? []) as TemplateRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Billing Design</span>
          <h1>Invoice Templates</h1>
          <p className="mini-meta">Reusable invoice branding, terms, colors, and PDF/print preview settings.</p>
        </div>
        <ButtonLink href="/admin/invoice-templates/new">New Template</ButtonLink>
      </div>
      <section className="panel">
        <h2>Templates</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Brand</th>
              <th>Colors</th>
              <th>Status</th>
              <th>Version</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.name}</td>
                <td>{template.config?.businessName ?? "Bridget Pope Designs"}</td>
                <td>
                  <span className="template-swatches">
                    <span style={{ background: template.config?.accentColor ?? "#c96f82" }} />
                    <span style={{ background: template.config?.secondaryColor ?? "#d9af6f" }} />
                  </span>
                </td>
                <td><span className="status">{template.is_default ? "Default" : "Active"}</span></td>
                <td>1</td>
                <td><a href={`/admin/invoice-templates/${template.id}`}>Edit</a></td>
              </tr>
            ))}
            {!templates.length ? (
              <tr>
                <td colSpan={6}>No templates yet. Create a default invoice template before sending invoices.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

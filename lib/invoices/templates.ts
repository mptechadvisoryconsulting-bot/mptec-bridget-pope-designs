export type InvoiceTemplateConfig = {
  businessName: string;
  accentColor: string;
  paymentTerms: string;
  footerNote: string;
  logoUrl?: string | null;
  paymentModel?: string;
};

export type InvoiceTemplateOverrides = Partial<Pick<InvoiceTemplateConfig, "accentColor" | "paymentTerms" | "footerNote" | "logoUrl">>;

export type InvoiceTemplateRow = {
  id: string;
  name: string;
  config: InvoiceTemplateConfig | Record<string, unknown>;
};

type SupabaseAdmin = {
  from(table: string): any;
};

export const defaultInvoiceTemplateConfig: InvoiceTemplateConfig = {
  businessName: "Bridget Pope Designs",
  accentColor: "#c96f82",
  paymentTerms: "Payment is due within 15 days unless another schedule is listed on the invoice.",
  footerNote: "Thank you for trusting Bridget Pope Designs with your celebration.",
  paymentModel: "destination_charges",
};

function normalizeConfig(config?: InvoiceTemplateRow["config"] | null): InvoiceTemplateConfig {
  return {
    ...defaultInvoiceTemplateConfig,
    ...(config && typeof config === "object" ? config : {}),
  } as InvoiceTemplateConfig;
}

export function buildInvoiceTemplateSnapshot(template: InvoiceTemplateRow, overrides: InvoiceTemplateOverrides = {}) {
  return {
    templateId: template.id,
    templateName: template.name,
    ...normalizeConfig(template.config),
    ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined && value !== "")),
  };
}

export async function resolveInvoiceTemplate(
  supabase: SupabaseAdmin,
  templateId?: string,
  overrides: InvoiceTemplateOverrides = {},
) {
  const query = supabase.from("invoice_templates").select("id,name,config");
  const { data: requested } = templateId
    ? await query.eq("id", templateId).maybeSingle()
    : await query.eq("is_default", true).maybeSingle();

  if (requested) {
    return {
      template: requested as InvoiceTemplateRow,
      snapshot: buildInvoiceTemplateSnapshot(requested as InvoiceTemplateRow, overrides),
    };
  }

  const { data: created, error } = await supabase
    .from("invoice_templates")
    .insert({
      name: "Luxury Event Invoice",
      is_default: true,
      config: defaultInvoiceTemplateConfig,
    })
    .select("id,name,config")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Unable to create invoice template");

  return {
    template: created as InvoiceTemplateRow,
    snapshot: buildInvoiceTemplateSnapshot(created as InvoiceTemplateRow, overrides),
  };
}

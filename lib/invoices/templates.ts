export type InvoiceTemplateConfig = {
  businessName: string;
  invoiceTitle: string;
  accentColor: string;
  secondaryColor: string;
  paymentTerms: string;
  footerNote: string;
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
  paymentModel?: string;
};

export type InvoiceTemplateOverrides = Partial<
  Pick<InvoiceTemplateConfig, "accentColor" | "secondaryColor" | "paymentTerms" | "footerNote" | "logoUrl" | "backgroundArtworkUrl" | "backgroundOpacity">
>;

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
  invoiceTitle: "Invoice",
  accentColor: "#c96f82",
  secondaryColor: "#d9af6f",
  paymentTerms: "Payment is due within 15 days unless another schedule is listed on the invoice.",
  footerNote: "Thank you for trusting Bridget Pope Designs with your celebration.",
  backgroundOpacity: 0.06,
  billToLabel: "Bill To",
  invoiceNumberLabel: "Invoice #",
  invoiceDateLabel: "Invoice Date",
  dueDateLabel: "Due Date",
  subtotalLabel: "Subtotal",
  discountLabel: "Discount",
  taxLabel: "Tax",
  amountPaidLabel: "Amount Paid",
  balanceDueLabel: "Balance Due",
  totalLabel: "Total",
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

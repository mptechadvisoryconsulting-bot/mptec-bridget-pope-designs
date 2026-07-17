export type InvoiceVisibleFieldsConfig = {
  discount: boolean;
  tax: boolean;
  amountPaid: boolean;
  dueDate: boolean;
  project: boolean;
  venue: boolean;
};

export type InvoiceTemplateConfig = {
  businessName: string;
  invoiceTitle: string;
  businessContactBlock?: string;

  logoUrl?: string | null;
  backgroundArtworkUrl?: string | null;
  backgroundOpacity?: number;
  artworkPosition?: "center" | "top" | "bottom" | "left" | "right";
  artworkFit?: "cover" | "contain";

  titleFontFamily?: string;
  titleFontSize?: number;
  titleAlignment?: "left" | "center" | "right";
  headingFontFamily?: string;
  bodyFontFamily?: string;
  bodyTextColor?: string;

  accentColor: string;
  secondaryColor: string;
  paperColor?: string;

  billToLabel?: string;
  invoiceNumberLabel?: string;
  invoiceDateLabel?: string;
  dueDateLabel?: string;
  itemsColumnLabel?: string;
  amountColumnLabel?: string;
  subtotalLabel?: string;
  discountLabel?: string;
  taxLabel?: string;
  amountPaidLabel?: string;
  balanceDueLabel?: string;
  totalLabel?: string;

  thankYouText?: string;
  termsHeading?: string;
  paymentTerms: string;
  footerNote: string;
  footerText?: string;

  visibleFields?: InvoiceVisibleFieldsConfig;
  separatorThickness?: number;
  separatorStyle?: "solid" | "dashed" | "dotted";
  lineItemSpacing?: number;
  footerSeparator?: boolean;
  footerAlignment?: "left" | "center" | "right";

  paymentModel?: string;
};

export type InvoiceTemplateOverrides = Partial<
  Pick<
    InvoiceTemplateConfig,
    | "accentColor"
    | "secondaryColor"
    | "paymentTerms"
    | "footerNote"
    | "thankYouText"
    | "footerText"
    | "logoUrl"
    | "backgroundArtworkUrl"
    | "backgroundOpacity"
  >
>;

export type InvoiceTemplateRow = {
  id: string;
  name: string;
  config: InvoiceTemplateConfig | Record<string, unknown>;
};

type SupabaseAdmin = {
  from(table: string): any;
};

export const defaultInvoiceVisibleFields: InvoiceVisibleFieldsConfig = {
  discount: true,
  tax: true,
  amountPaid: true,
  dueDate: true,
  project: true,
  venue: true,
};

export const defaultInvoiceTemplateConfig: InvoiceTemplateConfig = {
  businessName: "Bridget Pope Designs",
  invoiceTitle: "Invoice",
  businessContactBlock: "Murfreesboro, TN\n(629) 295-4210\nhello@bridgetpopedesigns.com",

  logoUrl: null,
  backgroundArtworkUrl: null,
  backgroundOpacity: 0.06,
  artworkPosition: "center",
  artworkFit: "cover",

  titleFontFamily: "Arial, Helvetica, sans-serif",
  titleFontSize: 76,
  titleAlignment: "left",
  headingFontFamily: "Arial, Helvetica, sans-serif",
  bodyFontFamily: "Georgia, 'Times New Roman', serif",
  bodyTextColor: "#111111",

  accentColor: "#c96f82",
  secondaryColor: "#d9af6f",
  paperColor: "#ffffff",

  billToLabel: "Bill To",
  invoiceNumberLabel: "Invoice #",
  invoiceDateLabel: "Invoice Date",
  dueDateLabel: "Due Date",
  itemsColumnLabel: "Description",
  amountColumnLabel: "Amount",
  subtotalLabel: "Subtotal",
  discountLabel: "Discount",
  taxLabel: "Tax",
  amountPaidLabel: "Amount Paid",
  balanceDueLabel: "Balance Due",
  totalLabel: "Total",

  thankYouText: "Thank you",
  termsHeading: "Terms & Conditions",
  paymentTerms: "Payment is due within 15 days unless another schedule is listed on the invoice.",
  footerNote: "Thank you for trusting Bridget Pope Designs with your celebration.",
  footerText: "",

  visibleFields: defaultInvoiceVisibleFields,
  separatorThickness: 2,
  separatorStyle: "solid",
  lineItemSpacing: 16,
  footerSeparator: true,
  footerAlignment: "right",

  paymentModel: "destination_charges",
};

export function normalizeInvoiceTemplateConfig(config?: InvoiceTemplateRow["config"] | null): InvoiceTemplateConfig {
  const merged = {
    ...defaultInvoiceTemplateConfig,
    ...(config && typeof config === "object" ? config : {}),
  } as InvoiceTemplateConfig;

  merged.visibleFields = {
    ...defaultInvoiceVisibleFields,
    ...(merged.visibleFields && typeof merged.visibleFields === "object" ? merged.visibleFields : {}),
  };

  if (!merged.thankYouText) {
    merged.thankYouText = merged.footerNote || defaultInvoiceTemplateConfig.thankYouText;
  }

  return merged;
}

function normalizeConfig(config?: InvoiceTemplateRow["config"] | null): InvoiceTemplateConfig {
  return normalizeInvoiceTemplateConfig(config);
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

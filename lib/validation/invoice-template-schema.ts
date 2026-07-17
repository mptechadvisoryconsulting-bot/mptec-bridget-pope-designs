import { z } from "zod";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color.");
const optionalUrlSchema = z.union([z.string().url(), z.literal(""), z.null()]).optional();
const optionalTextSchema = z.string().max(2000).optional().or(z.literal(""));
const alignmentSchema = z.enum(["left", "center", "right"]);

const visibleFieldsSchema = z.object({
  discount: z.boolean(),
  tax: z.boolean(),
  amountPaid: z.boolean(),
  dueDate: z.boolean(),
  project: z.boolean(),
  venue: z.boolean(),
});

export const invoiceTemplateConfigSchema = z.object({
  businessName: z.string().min(2).max(120),
  invoiceTitle: z.string().min(2).max(60),
  businessContactBlock: optionalTextSchema,

  logoUrl: optionalUrlSchema,
  backgroundArtworkUrl: optionalUrlSchema,
  backgroundOpacity: z.coerce.number().min(0).max(0.25),
  artworkPosition: z.enum(["center", "top", "bottom", "left", "right"]).optional(),
  artworkFit: z.enum(["cover", "contain"]).optional(),

  titleFontFamily: z.string().max(160).optional(),
  titleFontSize: z.coerce.number().min(24).max(120).optional(),
  titleAlignment: alignmentSchema.optional(),
  headingFontFamily: z.string().max(160).optional(),
  bodyFontFamily: z.string().max(160).optional(),
  bodyTextColor: colorSchema.optional(),

  accentColor: colorSchema,
  secondaryColor: colorSchema,
  paperColor: colorSchema.optional(),

  billToLabel: z.string().min(2).max(60),
  invoiceNumberLabel: z.string().min(2).max(60),
  invoiceDateLabel: z.string().min(2).max(60),
  dueDateLabel: z.string().min(2).max(60),
  itemsColumnLabel: z.string().min(2).max(60).optional(),
  amountColumnLabel: z.string().min(2).max(60).optional(),
  subtotalLabel: z.string().min(2).max(60),
  discountLabel: z.string().min(2).max(60),
  taxLabel: z.string().min(2).max(60),
  amountPaidLabel: z.string().min(2).max(60),
  balanceDueLabel: z.string().min(2).max(60),
  totalLabel: z.string().min(2).max(60),

  thankYouText: z.string().max(300).optional().or(z.literal("")),
  termsHeading: z.string().min(2).max(80).optional(),
  paymentTerms: z.string().min(5).max(2000),
  footerNote: z.string().min(2).max(300),
  footerText: z.string().max(500).optional().or(z.literal("")),

  visibleFields: visibleFieldsSchema.optional(),
  separatorThickness: z.coerce.number().min(0).max(8).optional(),
  separatorStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  lineItemSpacing: z.coerce.number().min(4).max(40).optional(),
  footerSeparator: z.boolean().optional(),
  footerAlignment: alignmentSchema.optional(),

  paymentModel: z.string().max(60).optional(),
});

export const invoiceTemplatePayloadSchema = z.object({
  name: z.string().min(2).max(120),
  isDefault: z.boolean().optional(),
  config: invoiceTemplateConfigSchema,
});

export const invoiceTemplateActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), name: z.string().min(2).max(120), config: invoiceTemplateConfigSchema }),
  z.object({ action: z.literal("set_default") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("duplicate") }),
]);

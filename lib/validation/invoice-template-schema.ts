import { z } from "zod";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color.");
const optionalUrlSchema = z.string().url().optional().or(z.literal(""));

export const invoiceTemplateConfigSchema = z.object({
  businessName: z.string().min(2).max(120),
  invoiceTitle: z.string().min(2).max(60),
  accentColor: colorSchema,
  secondaryColor: colorSchema,
  paymentTerms: z.string().min(5).max(2000),
  footerNote: z.string().min(2).max(300),
  logoUrl: optionalUrlSchema,
  backgroundArtworkUrl: optionalUrlSchema,
  backgroundOpacity: z.coerce.number().min(0).max(0.25),
  billToLabel: z.string().min(2).max(60),
  invoiceNumberLabel: z.string().min(2).max(60),
  invoiceDateLabel: z.string().min(2).max(60),
  dueDateLabel: z.string().min(2).max(60),
  subtotalLabel: z.string().min(2).max(60),
  discountLabel: z.string().min(2).max(60),
  taxLabel: z.string().min(2).max(60),
  amountPaidLabel: z.string().min(2).max(60),
  balanceDueLabel: z.string().min(2).max(60),
  totalLabel: z.string().min(2).max(60),
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

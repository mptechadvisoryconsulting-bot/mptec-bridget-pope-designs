import { z } from "zod";

export const invoiceEditSchema = z.object({
  templateId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  templateOverrides: z
    .object({
      accentColor: z.string().max(20).optional(),
      paymentTerms: z.string().max(2000).optional(),
      footerNote: z.string().max(500).optional(),
      thankYouText: z.string().max(300).optional(),
      footerText: z.string().max(500).optional(),
      logoUrl: z.string().url().optional().or(z.literal("")),
      backgroundArtworkUrl: z.string().url().optional().or(z.literal("")),
      backgroundOpacity: z.coerce.number().min(0).max(0.25).optional(),
    })
    .default({}),
  invoiceType: z.enum(["deposit", "installment", "final", "custom"]),
  description: z.string().min(2).max(500),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(
      z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(500).optional(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
  taxAmount: z.coerce.number().nonnegative().default(0),
  discountAmount: z.coerce.number().nonnegative().default(0),
});

export type InvoiceEditInput = z.infer<typeof invoiceEditSchema>;

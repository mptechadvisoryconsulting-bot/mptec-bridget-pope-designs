import { z } from "zod";

export const invoiceSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  proposalId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  templateId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  templateOverrides: z.object({
    accentColor: z.string().max(20).optional(),
    paymentTerms: z.string().max(1000).optional(),
    footerNote: z.string().max(500).optional(),
    logoUrl: z.string().url().optional().or(z.literal("")),
  }).default({}),
  invoiceType: z.enum(["deposit", "installment", "final", "custom"]),
  description: z.string().min(2).max(500),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(
    z.object({
      title: z.string().min(2).max(200),
      description: z.string().max(500).optional(),
      quantity: z.coerce.number().positive(),
      unitPrice: z.coerce.number().nonnegative(),
    }),
  ).min(1),
  taxAmount: z.coerce.number().nonnegative().default(0),
  discountAmount: z.coerce.number().nonnegative().default(0),
});

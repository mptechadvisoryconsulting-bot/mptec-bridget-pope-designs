import { z } from "zod";

export const paymentSchema = z.object({
  projectId: z.string(),
  invoiceId: z.string(),
  amount: z.number().positive(),
  paymentType: z.enum(["deposit", "partial", "final"]),
});

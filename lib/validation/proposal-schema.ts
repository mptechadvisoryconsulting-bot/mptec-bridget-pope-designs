import { z } from "zod";

export const proposalItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  category: z.string().trim().max(80).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const proposalCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(2).max(200).optional(),
  introduction: z.string().trim().max(2000).optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(proposalItemSchema).optional(),
});

export const proposalSchema = proposalCreateSchema;

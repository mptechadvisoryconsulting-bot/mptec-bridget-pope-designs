import { z } from "zod";

export const proposalSchema = z.object({
  clientId: z.string(),
  eventId: z.string(),
  items: z.array(z.object({ name: z.string(), qty: z.number(), price: z.number() })),
  deposit: z.number().min(0),
  expirationDate: z.string(),
});

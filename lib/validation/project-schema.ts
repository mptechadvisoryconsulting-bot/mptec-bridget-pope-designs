import { z } from "zod";

export const projectSchema = z.object({
  clientId: z.string(),
  eventDate: z.string(),
  venue: z.string(),
  guestCount: z.number().int().positive(),
  theme: z.string().optional(),
});

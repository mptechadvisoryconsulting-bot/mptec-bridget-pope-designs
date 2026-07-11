import { z } from "zod";

export const consultationSchema = z.object({
  leadId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  meetingType: z.enum(["phone", "video", "in_person"]),
  meetingLink: z.string().url().optional().or(z.literal("")),
  location: z.string().max(300).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export const consultationUpdateSchema = consultationSchema.partial().extend({
  status: z.enum(["requested", "scheduled", "completed", "cancelled", "no_show"]).optional(),
});

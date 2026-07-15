import { z } from "zod";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

const approvedService = z.enum(["Weddings", "Baby Showers", "Birthdays", "Corporate Events", "Luxury Balloons", "Full Planning"]);

export const inquirySchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  eventType: z.enum(["Wedding", "Baby Shower", "Birthday", "Corporate Event", "Luxury Balloons", "Full Planning"]),
  eventDate: optionalDate,
  venue: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().positive().optional().or(z.literal("")),
  estimatedBudget: z.string().trim().max(100).optional().or(z.literal("")),
  preferredConsultationMethod: z.enum(["phone", "video", "in_person"]),
  preferredConsultationDate: optionalDate,
  preferredConsultationTime: z.string().trim().max(30).optional().or(z.literal("")),
  eventColors: z.string().trim().max(300).optional().or(z.literal("")),
  eventTheme: z.string().trim().max(300).optional().or(z.literal("")),
  servicesNeeded: z.array(approvedService).min(1),
  message: z.string().trim().min(10).max(5000),
  inspirationFileNames: z.array(z.string().trim().max(200)).default([]),
  consent: z.boolean().refine((value) => value === true, "Consent is required"),
  company: z.string().max(0).optional().or(z.literal("")),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export function normalizeInquiry(input: InquiryInput) {
  return {
    ...input,
    eventDate: input.eventDate || null,
    venue: input.venue || null,
    city: input.city || null,
    guestCount: input.guestCount === "" ? null : input.guestCount ?? null,
    estimatedBudget: input.estimatedBudget || null,
    preferredConsultationDate: input.preferredConsultationDate || null,
    preferredConsultationTime: input.preferredConsultationTime || null,
    eventColors: input.eventColors || null,
    eventTheme: input.eventTheme || null,
  };
}

import { z } from "zod";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

const approvedService = z.enum([
  "Weddings",
  "Baby Showers",
  "Birthdays",
  "Corporate Events",
  "Luxury Balloons",
  "Full Planning",
]);

const referralSource = z.enum([
  "Instagram",
  "Facebook",
  "Google",
  "Friend or Family",
  "Wedding Vendor",
  "Previous Client",
  "Other",
]);

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export const inquirySchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  projectType: z.enum(["Wedding", "Baby Shower", "Birthday", "Corporate Event", "Luxury Balloons", "Full Planning"]),
  guestCount: z.coerce.number().int().positive().optional().or(z.literal("")),
  estimatedBudget: z.string().trim().max(100).optional().or(z.literal("")),
  servicesNeeded: z.array(approvedService).min(1),
  referralSource: referralSource,
  message: z.string().trim().min(10).max(5000),
  // Existing consultation workflow fields — kept for scheduling, not creative/upload.
  preferredConsultationMethod: z.enum(["phone", "video", "in_person"]).default("phone"),
  preferredConsultationDate: optionalDate,
  preferredConsultationTime: z.string().trim().max(30).optional().or(z.literal("")),
  consent: z.boolean().refine((value) => value === true, "Consent is required"),
  company: z.string().max(0).optional().or(z.literal("")),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export function normalizeInquiry(input: InquiryInput) {
  const { firstName, lastName } = splitFullName(input.fullName);

  return {
    fullName: input.fullName.trim(),
    firstName,
    lastName,
    email: input.email,
    phone: input.phone,
    eventType: input.projectType,
    projectType: input.projectType,
    guestCount: input.guestCount === "" ? null : input.guestCount ?? null,
    estimatedBudget: input.estimatedBudget || null,
    servicesNeeded: input.servicesNeeded,
    referralSource: input.referralSource,
    message: input.message,
    preferredConsultationMethod: input.preferredConsultationMethod,
    preferredConsultationDate: input.preferredConsultationDate || null,
    preferredConsultationTime: input.preferredConsultationTime || null,
  };
}

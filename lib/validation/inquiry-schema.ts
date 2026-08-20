import { z } from "zod";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

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
  projectType: z.string().trim().min(1).max(100),
  guestCount: z.coerce.number().int().positive().optional().or(z.literal("")),
  estimatedBudget: z.string().trim().max(100).optional().or(z.literal("")),
  servicesNeeded: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  referralSource: z.string().trim().min(1).max(100),
  message: z.string().trim().min(10).max(5000),
  // Existing consultation workflow values stay fixed because the scheduling table enforces these three values.
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

import { unstable_noStore as noStore } from "next/cache";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const inquiryQuestionKeys = [
  "fullName",
  "email",
  "phone",
  "projectType",
  "guestCount",
  "estimatedBudget",
  "servicesNeeded",
  "referralSource",
  "preferredConsultationMethod",
  "preferredConsultationDate",
  "preferredConsultationTime",
  "message",
  "consent",
] as const;

export type InquiryQuestionKey = (typeof inquiryQuestionKeys)[number];

export type InquiryQuestionConfig = {
  key: InquiryQuestionKey;
  label: string;
  visible: boolean;
  required: boolean;
};

export type InquiryContent = {
  eyebrow: string;
  heading: string;
  intro: string;
  submitButtonText: string;
  questions: InquiryQuestionConfig[];
  projectTypeOptions: string[];
  serviceOptions: string[];
  referralOptions: string[];
  consultationMethodLabels: {
    phone: string;
    video: string;
    in_person: string;
  };
};

const coreQuestionKeys = new Set<InquiryQuestionKey>([
  "fullName",
  "email",
  "phone",
  "projectType",
  "servicesNeeded",
  "message",
  "consent",
]);

export const defaultInquiryContent: InquiryContent = {
  eyebrow: "Start your event",
  heading: "Submit a Questionnaire",
  intro: "Share the details you know today. We will review your request and follow up to schedule a consultation.",
  submitButtonText: "Submit Inquiry",
  questions: [
    { key: "fullName", label: "Full Name", visible: true, required: true },
    { key: "email", label: "Email Address", visible: true, required: true },
    { key: "phone", label: "Phone Number", visible: true, required: true },
    { key: "projectType", label: "Project Type", visible: true, required: true },
    { key: "guestCount", label: "Estimated Guest Count", visible: true, required: false },
    { key: "estimatedBudget", label: "Budget", visible: true, required: false },
    { key: "servicesNeeded", label: "Services Interested In", visible: true, required: true },
    { key: "referralSource", label: "How Did You Hear About Us?", visible: true, required: false },
    { key: "preferredConsultationMethod", label: "Consultation Method", visible: true, required: false },
    { key: "preferredConsultationDate", label: "Preferred Consultation Date", visible: true, required: false },
    { key: "preferredConsultationTime", label: "Preferred Consultation Time", visible: true, required: false },
    { key: "message", label: "Leave Us a Message", visible: true, required: true },
    {
      key: "consent",
      label: "I consent to Bridget Pope Designs contacting me about this event inquiry.",
      visible: true,
      required: true,
    },
  ],
  projectTypeOptions: ["Wedding", "Baby Shower", "Birthday", "Corporate Event", "Luxury Balloons", "Full Planning"],
  serviceOptions: ["Weddings", "Baby Showers", "Birthdays", "Corporate Events", "Luxury Balloons", "Full Planning"],
  referralOptions: ["Instagram", "Facebook", "Google", "Friend or Family", "Wedding Vendor", "Previous Client", "Other"],
  consultationMethodLabels: {
    phone: "Phone",
    video: "Video call",
    in_person: "In person",
  },
};

function cleanText(value: unknown, fallback: string, max = 240) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().slice(0, max);
  return cleaned || fallback;
}

function cleanOptions(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const unique = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 100))
        .filter(Boolean),
    ),
  ).slice(0, 30);
  return unique.length ? unique : fallback;
}

export function normalizeInquiryContent(raw: unknown): InquiryContent {
  if (!raw || typeof raw !== "object") return defaultInquiryContent;
  const input = raw as Partial<InquiryContent>;
  const byKey = new Map(
    (Array.isArray(input.questions) ? input.questions : [])
      .filter((item): item is InquiryQuestionConfig => Boolean(item && inquiryQuestionKeys.includes(item.key)))
      .map((item) => [item.key, item]),
  );

  const questions = defaultInquiryContent.questions.map((fallback) => {
    const saved = byKey.get(fallback.key);
    const locked = coreQuestionKeys.has(fallback.key);
    return {
      key: fallback.key,
      label: cleanText(saved?.label, fallback.label, 180),
      visible: locked ? true : saved?.visible !== false,
      required: locked ? true : false,
    } satisfies InquiryQuestionConfig;
  });

  const methods = input.consultationMethodLabels ?? defaultInquiryContent.consultationMethodLabels;

  return {
    eyebrow: cleanText(input.eyebrow, defaultInquiryContent.eyebrow, 100),
    heading: cleanText(input.heading, defaultInquiryContent.heading, 160),
    intro: cleanText(input.intro, defaultInquiryContent.intro, 700),
    submitButtonText: cleanText(input.submitButtonText, defaultInquiryContent.submitButtonText, 80),
    questions,
    projectTypeOptions: cleanOptions(input.projectTypeOptions, defaultInquiryContent.projectTypeOptions),
    serviceOptions: cleanOptions(input.serviceOptions, defaultInquiryContent.serviceOptions),
    referralOptions: cleanOptions(input.referralOptions, defaultInquiryContent.referralOptions),
    consultationMethodLabels: {
      phone: cleanText(methods.phone, defaultInquiryContent.consultationMethodLabels.phone, 60),
      video: cleanText(methods.video, defaultInquiryContent.consultationMethodLabels.video, 60),
      in_person: cleanText(methods.in_person, defaultInquiryContent.consultationMethodLabels.in_person, 60),
    },
  };
}

export async function getInquiryContent(): Promise<InquiryContent> {
  noStore();
  if (!hasSupabaseAdminEnv()) return defaultInquiryContent;
  const { data } = await createAdminClient().from("website_content").select("content").eq("section_key", "inquiry").maybeSingle();
  return normalizeInquiryContent(data?.content);
}

export async function saveInquiryContent(content: unknown, updatedBy?: string | null) {
  const normalized = normalizeInquiryContent(content);
  const { data, error } = await createAdminClient()
    .from("website_content")
    .upsert(
      {
        section_key: "inquiry",
        content: normalized,
        updated_by: updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "section_key" },
    )
    .select("section_key,content,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, content: normalized };
}

export function validateInquiryOptions(
  input: { projectType: string; servicesNeeded: string[]; referralSource?: string | null },
  config: InquiryContent,
) {
  if (!config.projectTypeOptions.includes(input.projectType)) return "Please select a valid project type.";
  if (!input.servicesNeeded.length || input.servicesNeeded.some((item) => !config.serviceOptions.includes(item))) {
    return "Please select valid services.";
  }
  if (input.referralSource && !config.referralOptions.includes(input.referralSource)) {
    return "Please select a valid referral source.";
  }
  return null;
}

export function questionConfig(config: InquiryContent, key: InquiryQuestionKey) {
  return config.questions.find((question) => question.key === key) ?? defaultInquiryContent.questions.find((question) => question.key === key)!;
}

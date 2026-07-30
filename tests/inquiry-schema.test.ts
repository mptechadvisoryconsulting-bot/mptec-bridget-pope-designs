import { describe, expect, it } from "vitest";
import { inquirySchema, normalizeInquiry } from "@/lib/validation/inquiry-schema";

describe("inquirySchema", () => {
  const valid = {
    fullName: "Ashley Johnson",
    email: "ashley@example.com",
    phone: "(629) 555-0100",
    projectType: "Wedding" as const,
    guestCount: 120,
    estimatedBudget: "$8,000",
    servicesNeeded: ["Weddings"] as const,
    referralSource: "Instagram" as const,
    message: "We would love a soft blush reception design.",
    preferredConsultationMethod: "phone" as const,
    preferredConsultationDate: "",
    preferredConsultationTime: "",
    consent: true,
    company: "",
  };

  it("accepts Bridget's approved questionnaire fields", () => {
    const parsed = inquirySchema.parse(valid);
    expect(parsed.fullName).toBe("Ashley Johnson");
    expect(parsed.referralSource).toBe("Instagram");
    expect(parsed.servicesNeeded).toEqual(["Weddings"]);
  });

  it("rejects inspiration / upload style payloads silently by omitting them from schema", () => {
    const parsed = inquirySchema.parse({
      ...valid,
      inspirationFileNames: ["moodboard.png"],
      pinterestUrl: "https://pinterest.com/x",
    } as never);
    expect("inspirationFileNames" in parsed).toBe(false);
  });

  it("normalizes full name into first/last for CRM lead rows", () => {
    const normalized = normalizeInquiry(inquirySchema.parse(valid));
    expect(normalized.firstName).toBe("Ashley");
    expect(normalized.lastName).toBe("Johnson");
    expect(normalized.eventType).toBe("Wedding");
    expect(normalized.referralSource).toBe("Instagram");
  });

  it("requires consent and a message", () => {
    expect(() => inquirySchema.parse({ ...valid, consent: false })).toThrow();
    expect(() => inquirySchema.parse({ ...valid, message: "short" })).toThrow();
  });
});

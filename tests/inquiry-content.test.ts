import { describe, expect, it } from "vitest";
import {
  defaultInquiryContent,
  normalizeInquiryContent,
  validateInquiryOptions,
} from "@/lib/website/inquiry-content";

describe("inquiry questionnaire content", () => {
  it("preserves the existing public questionnaire as the default", () => {
    const content = normalizeInquiryContent(null);
    expect(content.heading).toBe("Submit a Questionnaire");
    expect(content.projectTypeOptions).toContain("Wedding");
    expect(content.serviceOptions).toContain("Weddings");
  });

  it("allows owner wording and optional visibility changes while protecting core fields", () => {
    const content = normalizeInquiryContent({
      heading: "Tell Us About Your Celebration",
      questions: [
        { key: "fullName", label: "Who are we celebrating with?", visible: false, required: false },
        { key: "guestCount", label: "About how many guests?", visible: false, required: false },
      ],
    });

    expect(content.heading).toBe("Tell Us About Your Celebration");
    expect(content.questions.find((item) => item.key === "fullName")).toMatchObject({
      label: "Who are we celebrating with?",
      visible: true,
      required: true,
    });
    expect(content.questions.find((item) => item.key === "guestCount")?.visible).toBe(false);
  });

  it("accepts saved choice lists and rejects values outside them", () => {
    const content = normalizeInquiryContent({
      projectTypeOptions: ["Wedding", "Anniversary"],
      serviceOptions: ["Full Planning", "Decor Only"],
      referralOptions: ["Google", "Referral"],
    });

    expect(
      validateInquiryOptions(
        { projectType: "Anniversary", servicesNeeded: ["Decor Only"], referralSource: "Referral" },
        content,
      ),
    ).toBeNull();
    expect(
      validateInquiryOptions(
        { projectType: "Unknown", servicesNeeded: ["Decor Only"], referralSource: "Referral" },
        content,
      ),
    ).toMatch(/project type/i);
  });

  it("falls back to safe choices when an owner submits empty option lists", () => {
    const content = normalizeInquiryContent({
      projectTypeOptions: [],
      serviceOptions: [],
      referralOptions: [],
    });
    expect(content.projectTypeOptions).toEqual(defaultInquiryContent.projectTypeOptions);
    expect(content.serviceOptions).toEqual(defaultInquiryContent.serviceOptions);
    expect(content.referralOptions).toEqual(defaultInquiryContent.referralOptions);
  });
});

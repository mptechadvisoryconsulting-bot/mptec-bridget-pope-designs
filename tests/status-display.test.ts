import { describe, expect, it } from "vitest";
import { formatStatusLabel, normalizeStatusKey, statusBadgeClassName, statusTone } from "@/lib/status-display";

describe("status-display", () => {
  it("normalizes mixed casing and separators", () => {
    expect(normalizeStatusKey("Partially Paid")).toBe("partially_paid");
    expect(normalizeStatusKey("awaiting-client-feedback")).toBe("awaiting_client_feedback");
  });

  it("maps common portal statuses to labels and tones", () => {
    expect(formatStatusLabel("paid")).toBe("Paid");
    expect(statusTone("paid")).toBe("success");
    expect(formatStatusLabel("overdue")).toBe("Overdue");
    expect(statusTone("overdue")).toBe("danger");
    expect(formatStatusLabel("cancelled")).toBe("Cancelled");
    expect(formatStatusLabel("voided")).toBe("Void");
    expect(statusTone("void")).toBe("muted");
    expect(formatStatusLabel("booked")).toBe("Booked");
    expect(statusTone("pending")).toBe("warning");
  });

  it("falls back gracefully for unknown values", () => {
    expect(formatStatusLabel("custom_stage")).toBe("Custom Stage");
    expect(statusTone("custom_stage")).toBe("neutral");
    expect(statusBadgeClassName("paid")).toBe("status status-success");
  });
});

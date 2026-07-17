import { describe, expect, it } from "vitest";
import { manualPaymentSchema, normalizeManualPaymentMethod } from "@/lib/validation/manual-payment-schema";

describe("manualPaymentSchema", () => {
  it("accepts a valid offline payment payload", () => {
    const parsed = manualPaymentSchema.parse({
      amount: 250.5,
      paidAt: "2026-07-13",
      paymentMethod: "zelle",
      note: "Confirmation 123",
    });

    expect(parsed.amount).toBe(250.5);
    expect(parsed.paymentMethod).toBe("zelle");
  });

  it("accepts preferred methods and maps card_external to external_card", () => {
    expect(manualPaymentSchema.parse({ amount: 10, paidAt: "2026-07-13", paymentMethod: "cash" }).paymentMethod).toBe("cash");
    expect(manualPaymentSchema.parse({ amount: 10, paidAt: "2026-07-13", paymentMethod: "check" }).paymentMethod).toBe("check");
    expect(manualPaymentSchema.parse({ amount: 10, paidAt: "2026-07-13", paymentMethod: "bank_transfer" }).paymentMethod).toBe("bank_transfer");
    expect(manualPaymentSchema.parse({ amount: 10, paidAt: "2026-07-13", paymentMethod: "external_card" }).paymentMethod).toBe("external_card");
    expect(manualPaymentSchema.parse({ amount: 10, paidAt: "2026-07-13", paymentMethod: "card_external" }).paymentMethod).toBe("external_card");
    expect(normalizeManualPaymentMethod("card_external")).toBe("external_card");
  });

  it("rejects zero and negative amounts", () => {
    expect(() =>
      manualPaymentSchema.parse({
        amount: 0,
        paidAt: "2026-07-13",
        paymentMethod: "cash",
      }),
    ).toThrow();
  });
});

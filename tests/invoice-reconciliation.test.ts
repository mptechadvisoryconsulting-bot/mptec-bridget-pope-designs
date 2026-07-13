import { describe, expect, it } from "vitest";
import { derivePaymentRefundStatus } from "@/lib/billing/invoice-reconciliation";

describe("payment refund status derivation", () => {
  it("keeps a payment paid when there are no successful refunds", () => {
    expect(derivePaymentRefundStatus(5_000, 0)).toBe("paid");
  });

  it("marks a payment partially refunded when refund total is below gross", () => {
    expect(derivePaymentRefundStatus(5_000, 100)).toBe("partially_refunded");
  });

  it("marks a payment refunded when cumulative refunds reach the gross amount", () => {
    expect(derivePaymentRefundStatus(5_000, 5_000)).toBe("refunded");
    expect(derivePaymentRefundStatus(5_000, 5_500)).toBe("refunded");
  });

  it("keeps pending refunds distinct from successful partial refunds", () => {
    expect(derivePaymentRefundStatus(5_000, 0, true)).toBe("refund_pending");
  });
});

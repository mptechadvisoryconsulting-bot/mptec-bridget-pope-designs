import { describe, expect, it } from "vitest";
import { deriveInvoiceStatusAfterReconciliation, derivePaymentRefundStatus } from "@/lib/billing/invoice-reconciliation";

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

describe("invoice reconciliation zero floor", () => {
  it("keeps draft status when unpaid and floors balance at zero", () => {
    const result = deriveInvoiceStatusAfterReconciliation({
      total: 1000,
      netPaid: 0,
      grossPaid: 0,
      refunded: 0,
      currentStatus: "draft",
    });
    expect(result.status).toBe("draft");
    expect(result.balanceDue).toBe(1000);
    expect(result.netPaid).toBe(0);
  });

  it("keeps sent / payment_arrangement when unpaid", () => {
    expect(
      deriveInvoiceStatusAfterReconciliation({
        total: 1000,
        netPaid: 0,
        grossPaid: 0,
        refunded: 0,
        currentStatus: "sent",
      }).status,
    ).toBe("sent");
    expect(
      deriveInvoiceStatusAfterReconciliation({
        total: 1000,
        netPaid: 0,
        grossPaid: 0,
        refunded: 0,
        currentStatus: "payment_arrangement",
      }).status,
    ).toBe("payment_arrangement");
  });

  it("never returns a negative balance when overpaid", () => {
    const result = deriveInvoiceStatusAfterReconciliation({
      total: 100,
      netPaid: 150,
      grossPaid: 150,
      refunded: 0,
      currentStatus: "sent",
    });
    expect(result.balanceDue).toBe(0);
    expect(result.status).toBe("paid");
  });

  it("marks partial payment after first payment on a sent invoice", () => {
    expect(
      deriveInvoiceStatusAfterReconciliation({
        total: 1000,
        netPaid: 250,
        grossPaid: 250,
        refunded: 0,
        currentStatus: "sent",
      }).status,
    ).toBe("partially_paid");
  });
});

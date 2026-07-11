import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-calculations";

describe("calculateInvoiceTotals", () => {
  it("totals multiple line items", () => {
    const totals = calculateInvoiceTotals([
      { title: "Backdrop", quantity: 1, unitPrice: 1200 },
      { title: "Centerpieces", quantity: 10, unitPrice: 75 },
    ]);

    expect(totals.subtotal).toBe(1950);
    expect(totals.total).toBe(1950);
  });

  it("rounds currency to cents", () => {
    const totals = calculateInvoiceTotals([{ quantity: 3, unitPrice: 19.995 }]);

    expect(totals.items[0].total).toBe(60);
    expect(totals.total).toBe(60);
  });

  it("prevents discounts from making totals negative", () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 0, 500);

    expect(totals.total).toBe(0);
  });

  it("supports fractional quantities", () => {
    const totals = calculateInvoiceTotals([{ quantity: 2.5, unitPrice: 80 }], 12.34, 10);

    expect(totals.subtotal).toBe(200);
    expect(totals.total).toBe(202.34);
  });
});

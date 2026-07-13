import { describe, expect, it } from "vitest";
import { buildInvoiceRenderModel } from "@/lib/invoices/render-model";

const baseInvoice = {
  invoice_number: "INV-20260101-ABC",
  invoice_type: "deposit",
  description: "Deposit for design services",
  subtotal: 1000,
  tax_amount: 50,
  discount_amount: 100,
  total: 950,
  amount_paid: 200,
  balance_due: 750,
  due_date: "2026-02-01",
  created_at: "2026-01-01T00:00:00.000Z",
  status: "sent",
  active_version: 1,
  template_snapshot: null,
};

const baseItems = [
  { id: "1", title: "Backdrop", description: "Luxury backdrop", quantity: 1, unit_price: 1000, total: 1000 },
];

describe("buildInvoiceRenderModel", () => {
  it("normalizes totals identically regardless of caller (browser vs PDF vs email parity)", () => {
    const model = buildInvoiceRenderModel({
      invoice: baseInvoice,
      items: baseItems,
      clientName: "Sample Client",
      clientEmail: "sample@example.com",
      projectName: "Sample Event",
      venue: "Sample Venue",
    });

    expect(model.totals).toEqual({ subtotal: 1000, discount: 100, tax: 50, amountPaid: 200, balanceDue: 750, total: 950 });
    expect(model.flags).toEqual({ showDiscount: true, showTax: true, showAmountPaid: true, showDueDate: true, showProject: true, showVenue: true });
    expect(model.template.accentColor).toBe("#c96f82");
  });

  it("hides zero-value optional fields but always shows subtotal/balance/total", () => {
    const model = buildInvoiceRenderModel({
      invoice: { ...baseInvoice, tax_amount: 0, discount_amount: 0, amount_paid: 0 },
      items: baseItems,
      clientName: "Sample Client",
    });

    expect(model.flags.showTax).toBe(false);
    expect(model.flags.showDiscount).toBe(false);
    expect(model.flags.showAmountPaid).toBe(false);
  });

  it("respects explicit visibleFields overrides even when a value is positive", () => {
    const model = buildInvoiceRenderModel({
      invoice: { ...baseInvoice, template_snapshot: { visibleFields: { discount: false, tax: true, amountPaid: true, dueDate: true, project: true, venue: true } } },
      items: baseItems,
      clientName: "Sample Client",
    });

    expect(model.flags.showDiscount).toBe(false);
  });

  it("marks invoices with active_version greater than 1 as updated", () => {
    const model = buildInvoiceRenderModel({
      invoice: { ...baseInvoice, active_version: 2 },
      items: baseItems,
      clientName: "Sample Client",
    });

    expect(model.isUpdatedVersion).toBe(true);
    expect(model.versionNumber).toBe(2);
  });

  it("accepts historical version item snapshots using camelCase unitPrice", () => {
    const model = buildInvoiceRenderModel({
      invoice: baseInvoice,
      items: [{ title: "Backdrop", description: "Luxury backdrop", quantity: 2, unitPrice: 500, total: 1000 }],
      clientName: "Sample Client",
    });

    expect(model.items[0].unitPrice).toBe(500);
    expect(model.items[0].total).toBe(1000);
  });
});

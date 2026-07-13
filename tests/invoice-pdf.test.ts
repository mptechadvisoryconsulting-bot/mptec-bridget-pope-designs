import { describe, expect, it } from "vitest";
import { buildInvoiceRenderModel } from "@/lib/invoices/render-model";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";

describe("generateInvoicePdf", () => {
  it("produces a valid PDF buffer for a standard invoice render model", async () => {
    const model = buildInvoiceRenderModel({
      invoice: {
        invoice_number: "INV-20260101-XYZ",
        invoice_type: "final",
        description: "Final balance",
        subtotal: 2000,
        tax_amount: 0,
        discount_amount: 0,
        total: 2000,
        amount_paid: 0,
        balance_due: 2000,
        due_date: "2026-03-01",
        created_at: "2026-01-15T00:00:00.000Z",
        status: "sent",
        active_version: 1,
        template_snapshot: null,
      },
      items: [{ id: "1", title: "Final Design Package", description: "Complete design execution", quantity: 1, unit_price: 2000, total: 2000 }],
      clientName: "Sample Client",
      clientEmail: "sample@example.com",
      projectName: "Sample Event",
      venue: "Sample Venue",
    });

    const pdf = await generateInvoicePdf(model);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("does not throw when there are no line items", async () => {
    const model = buildInvoiceRenderModel({
      invoice: {
        invoice_number: "INV-20260101-EMPTY",
        subtotal: 0,
        total: 0,
        balance_due: 0,
        created_at: "2026-01-15T00:00:00.000Z",
        status: "draft",
        active_version: 1,
      },
      items: [],
      clientName: "Sample Client",
    });

    const pdf = await generateInvoicePdf(model);
    expect(pdf.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});

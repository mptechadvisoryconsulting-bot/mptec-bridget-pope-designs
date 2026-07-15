import { describe, expect, it } from "vitest";
import { toHoneyBookReferenceInsert } from "@/lib/honeybook/references";
import { honeybookIntegrationEventSchema, honeybookReferenceSchema } from "@/lib/validation/honeybook-schema";

describe("HoneyBook reference records", () => {
  it("normalizes manual reference values without creating payment authority", () => {
    const record = toHoneyBookReferenceInsert({
      projectId: "project-1",
      clientId: "client-1",
      honeybookProjectId: " HB-123 ",
      honeybookInvoiceNumber: " INV-2026 ",
      invoiceTotal: 1200.129,
      amountPaid: 300.335,
      balanceRemaining: -25,
      invoiceStatus: " sent ",
      honeybookUrl: " https://www.honeybook.com/ ",
      source: "manual",
    });

    expect(record).toMatchObject({
      project_id: "project-1",
      client_id: "client-1",
      honeybook_project_id: "HB-123",
      honeybook_invoice_number: "INV-2026",
      invoice_total: 1200.13,
      amount_paid: 300.34,
      balance_remaining: 0,
      invoice_status: "sent",
      honeybook_url: "https://www.honeybook.com/",
      source: "manual",
      review_status: "confirmed",
    });
  });

  it("validates future automation bridge events but does not require direct HoneyBook APIs", () => {
    const event = honeybookIntegrationEventSchema.parse({
      event_id: "zapier-event-1",
      event_type: "invoice.updated",
      occurred_at: "2026-07-15T12:00:00.000Z",
      honeybook_project_id: "HB-123",
      client_email: "client@example.com",
      invoice_number: "INV-10",
      invoice_total: "1000.00",
      amount_paid: "500.00",
      balance_remaining: "500.00",
      invoice_status: "partially_paid",
      due_date: "2026-08-01",
      honeybook_url: "https://www.honeybook.com/",
    });

    expect(event.invoice_total).toBe(1000);
    expect(event.amount_paid).toBe(500);
    expect(event.balance_remaining).toBe(500);
  });

  it("accepts only project-linked reference payloads", () => {
    const parsed = honeybookReferenceSchema.safeParse({
      projectId: "2f9ebc7e-b92e-4aac-b536-8d566ef504b6",
      clientId: "9605be46-6f67-4a32-8855-5cfc4a0030b1",
      honeybookInvoiceNumber: "HB-42",
      invoiceTotal: "2500",
      amountPaid: "1500",
      balanceRemaining: "1000",
      invoiceStatus: "sent",
      source: "manual",
    });

    expect(parsed.success).toBe(true);
  });
});

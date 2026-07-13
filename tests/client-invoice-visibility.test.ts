import { describe, expect, it } from "vitest";
import {
  CLIENT_VISIBLE_INVOICE_STATUSES,
  isClientVisibleInvoice,
  isClientVisibleInvoiceStatus,
} from "@/lib/invoices/client-visibility";

describe("client invoice visibility", () => {
  it("excludes draft invoices even when sent_at is present", () => {
    expect(isClientVisibleInvoice({ status: "draft", sent_at: "2026-07-01T00:00:00Z" })).toBe(false);
  });

  it("includes sent and payment_arrangement invoices", () => {
    expect(isClientVisibleInvoice({ status: "sent", sent_at: "2026-07-01T00:00:00Z" })).toBe(true);
    expect(isClientVisibleInvoice({ status: "payment_arrangement" })).toBe(true);
    expect(isClientVisibleInvoiceStatus("partially_paid")).toBe(true);
  });

  it("does not treat draft as a client-visible status", () => {
    expect(CLIENT_VISIBLE_INVOICE_STATUSES).not.toContain("draft");
    expect(isClientVisibleInvoiceStatus("draft")).toBe(false);
  });
});

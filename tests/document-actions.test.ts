import { describe, expect, it } from "vitest";
import {
  canCancelInvoice,
  canCancelProposal,
  canDeleteInvoice,
  canDeleteProposal,
  invoiceCancelStatus,
} from "@/lib/billing/document-actions";

describe("document-actions", () => {
  it("allows deleting draft invoices without payments only", () => {
    expect(canDeleteInvoice("draft", 0)).toBe(true);
    expect(canDeleteInvoice("draft", 10)).toBe(false);
    expect(canDeleteInvoice("sent", 0)).toBe(false);
  });

  it("allows cancelling unpaid non-terminal invoices, not paid ones", () => {
    expect(canCancelInvoice("sent")).toBe(true);
    expect(canCancelInvoice("partially_paid")).toBe(true);
    expect(canCancelInvoice("draft")).toBe(true);
    expect(canCancelInvoice("paid")).toBe(false);
    expect(canCancelInvoice("void")).toBe(false);
    expect(canCancelInvoice("cancelled")).toBe(false);
  });

  it("maps cancel status to void for non-draft invoices", () => {
    expect(invoiceCancelStatus("draft")).toBe("cancelled");
    expect(invoiceCancelStatus("sent")).toBe("void");
  });

  it("allows deleting draft proposals and cancelling sent/viewed ones", () => {
    expect(canDeleteProposal("draft")).toBe(true);
    expect(canDeleteProposal("sent")).toBe(false);
    expect(canCancelProposal("sent")).toBe(true);
    expect(canCancelProposal("viewed")).toBe(true);
    expect(canCancelProposal("draft")).toBe(false);
    expect(canCancelProposal("approved")).toBe(false);
    expect(canCancelProposal("cancelled")).toBe(false);
  });
});

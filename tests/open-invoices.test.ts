import { describe, expect, it } from "vitest";
import { isOpenBalanceInvoice, NON_OPEN_INVOICE_STATUSES } from "@/lib/billing/open-invoices";

describe("open invoice filters", () => {
  it("excludes draft, cancelled, and void from open balances", () => {
    expect(NON_OPEN_INVOICE_STATUSES).toEqual(["draft", "cancelled", "void"]);
    expect(isOpenBalanceInvoice({ balance_due: 100, status: "pending" })).toBe(true);
    expect(isOpenBalanceInvoice({ balance_due: 100, status: "overdue" })).toBe(true);
    expect(isOpenBalanceInvoice({ balance_due: 100, status: "draft" })).toBe(false);
    expect(isOpenBalanceInvoice({ balance_due: 100, status: "cancelled" })).toBe(false);
    expect(isOpenBalanceInvoice({ balance_due: 100, status: "void" })).toBe(false);
    expect(isOpenBalanceInvoice({ balance_due: 0, status: "pending" })).toBe(false);
  });
});

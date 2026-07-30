/**
 * Open / unpaid invoice filters — aligned with reports open balances.
 * Excludes draft, cancelled, and void (legacy alias) so Action Center and
 * /admin/invoices?status=unpaid do not count closed invoices with leftover balance_due.
 */
export const NON_OPEN_INVOICE_STATUSES = ["draft", "cancelled", "void"] as const;

/** balance_due > 0 and status not in draft/cancelled/void */
export function applyOpenBalanceFilter<
  T extends {
    gt: (column: string, value: number) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(query: T): T {
  return query
    .gt("balance_due", 0)
    .not("status", "in", `(${NON_OPEN_INVOICE_STATUSES.map((s) => `"${s}"`).join(",")})`);
}

export function isOpenBalanceInvoice(row: { balance_due?: number | null; status?: string | null }) {
  const status = String(row.status ?? "");
  return Number(row.balance_due ?? 0) > 0 && !NON_OPEN_INVOICE_STATUSES.includes(status as (typeof NON_OPEN_INVOICE_STATUSES)[number]);
}

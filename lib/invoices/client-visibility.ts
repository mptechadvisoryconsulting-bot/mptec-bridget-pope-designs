export const CLIENT_VISIBLE_INVOICE_STATUSES = [
  "sent",
  "viewed",
  "payment_arrangement",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "void",
  "pending",
  "processing",
  "failed",
  "payment_failed",
  "refunded",
  "partially_refunded",
] as const;

export type ClientVisibleInvoiceStatus = (typeof CLIENT_VISIBLE_INVOICE_STATUSES)[number];

export function isClientVisibleInvoiceStatus(status?: string | null) {
  if (!status || status === "draft") return false;
  return (CLIENT_VISIBLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

export function isClientVisibleInvoice(invoice: { status?: string | null; sent_at?: string | null }) {
  if (invoice.status === "draft") return false;
  if (invoice.sent_at) return true;
  return isClientVisibleInvoiceStatus(invoice.status);
}

/** Apply client-facing invoice visibility to a Supabase query builder. */
export function applyClientInvoiceVisibilityFilter<T extends { not: Function; in: Function }>(query: T): T {
  return query.not("status", "eq", "draft").in("status", [...CLIENT_VISIBLE_INVOICE_STATUSES]) as T;
}

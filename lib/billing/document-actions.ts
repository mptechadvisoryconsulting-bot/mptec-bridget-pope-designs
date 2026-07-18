const PAID_OR_SETTLED_INVOICE = new Set(["paid", "refunded", "partially_refunded"]);
const TERMINAL_INVOICE = new Set(["cancelled", "void", "paid", "refunded", "partially_refunded"]);
const CANCELABLE_PROPOSAL = new Set(["sent", "viewed", "expired"]);
const TERMINAL_PROPOSAL = new Set(["cancelled", "rejected", "approved"]);

export function canDeleteInvoice(status: string, amountPaid = 0) {
  return status === "draft" && Number(amountPaid ?? 0) <= 0;
}

export function canCancelInvoice(status: string) {
  if (PAID_OR_SETTLED_INVOICE.has(status)) return false;
  if (TERMINAL_INVOICE.has(status)) return false;
  return true;
}

export function canDeleteProposal(status: string) {
  return status === "draft";
}

export function canCancelProposal(status: string) {
  if (TERMINAL_PROPOSAL.has(status) || status === "draft") return false;
  return CANCELABLE_PROPOSAL.has(status);
}

export function invoiceCancelStatus(status: string) {
  // Prefer void for open/sent invoices that never reached paid; keep cancelled as synonym.
  if (status === "draft") return "cancelled";
  return "void";
}

"use client";

import { useRouter } from "next/navigation";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { canCancelInvoice, canDeleteInvoice } from "@/lib/billing/document-actions";

export function InvoiceDocumentActions({
  invoiceId,
  status,
  amountPaid = 0,
  primaryHref,
  primaryLabel = "Open",
  extraActions = [],
  redirectOnDelete = "/admin/invoices",
}: {
  invoiceId: string;
  status: string;
  amountPaid?: number;
  primaryHref?: string;
  primaryLabel?: string;
  extraActions?: Array<{ label: string; href: string }>;
  redirectOnDelete?: string | null;
}) {
  const router = useRouter();
  const allowDelete = canDeleteInvoice(status, amountPaid);
  const allowCancel = canCancelInvoice(status);

  async function cancelInvoice() {
    if (!window.confirm("Cancel/void this invoice? Clients will no longer be able to pay it.")) return;
    const response = await fetch(`/api/invoices/${invoiceId}/cancel`, { method: "POST" });
    const result = await response.json().catch(() => ({ success: false, message: "Unable to cancel invoice." }));
    if (!response.ok || !result.success) {
      window.alert(result.message ?? "Unable to cancel invoice.");
      return;
    }
    router.refresh();
  }

  async function deleteInvoice() {
    if (!window.confirm("Permanently delete this draft invoice? This cannot be undone.")) return;
    const response = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({ success: false, message: "Unable to delete invoice." }));
    if (!response.ok || !result.success) {
      window.alert(result.message ?? "Unable to delete invoice.");
      return;
    }
    if (redirectOnDelete) {
      window.location.href = redirectOnDelete;
      return;
    }
    router.refresh();
  }

  return (
    <QueueItemActions
      primaryAction={primaryHref ? { label: primaryLabel, href: primaryHref } : null}
      actions={[
        ...extraActions,
        ...(allowCancel ? [{ label: "Cancel / Void", onSelect: cancelInvoice, destructive: true }] : []),
        ...(allowDelete ? [{ label: "Delete", onSelect: deleteInvoice, destructive: true }] : []),
      ]}
    />
  );
}

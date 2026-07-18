"use client";

import { useRouter } from "next/navigation";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { canCancelProposal, canDeleteProposal } from "@/lib/billing/document-actions";

export function ProposalDocumentActions({
  proposalId,
  status,
  primaryHref,
  primaryLabel = "Open",
  extraActions = [],
  redirectOnDelete = "/admin/proposals",
}: {
  proposalId: string;
  status: string;
  primaryHref?: string;
  primaryLabel?: string;
  extraActions?: Array<{ label: string; href: string }>;
  redirectOnDelete?: string | null;
}) {
  const router = useRouter();
  const allowDelete = canDeleteProposal(status);
  const allowCancel = canCancelProposal(status);

  async function cancelProposal() {
    if (!window.confirm("Cancel this proposal? It will no longer be available for client approval.")) return;
    const response = await fetch(`/api/proposals/${proposalId}/cancel`, { method: "POST" });
    const result = await response.json().catch(() => ({ success: false, message: "Unable to cancel proposal." }));
    if (!response.ok || !result.success) {
      window.alert(result.message ?? "Unable to cancel proposal.");
      return;
    }
    router.refresh();
  }

  async function deleteProposal() {
    if (!window.confirm("Permanently delete this draft proposal? This cannot be undone.")) return;
    const response = await fetch(`/api/proposals/${proposalId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({ success: false, message: "Unable to delete proposal." }));
    if (!response.ok || !result.success) {
      window.alert(result.message ?? "Unable to delete proposal.");
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
        ...(allowCancel ? [{ label: "Cancel", onSelect: cancelProposal, destructive: true }] : []),
        ...(allowDelete ? [{ label: "Delete", onSelect: deleteProposal, destructive: true }] : []),
      ]}
    />
  );
}

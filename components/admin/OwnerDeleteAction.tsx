"use client";

import { useState } from "react";
import { QueueItemActions } from "@/components/admin/QueueItemActions";

type OwnerDeleteActionProps = {
  endpoint: string;
  confirmName: string;
  redirectTo: string;
  /** Human label used in confirmation copy (e.g. "client", "project"). */
  entityLabel?: string;
  /** When true, related records are deleted with the parent (clients with projects). */
  cascade?: boolean;
  /** Extra warning shown in the confirmation prompt. */
  warning?: string;
  /** Require typing DELETE exactly (used when paid invoices exist). */
  requireDeleteWord?: boolean;
  buttonLabel?: string;
  /** Render as a standalone button instead of Actions menu item. */
  variant?: "menu" | "button";
};

export function OwnerDeleteAction({
  endpoint,
  confirmName,
  redirectTo,
  entityLabel = "record",
  cascade = false,
  warning,
  requireDeleteWord = false,
  buttonLabel = "Delete",
  variant = "menu",
}: OwnerDeleteActionProps) {
  const [busy, setBusy] = useState(false);

  async function runDelete() {
    if (busy) return;

    const expected = requireDeleteWord ? "DELETE" : confirmName;
    const promptLines = [
      `Permanently delete this ${entityLabel}? This cannot be undone.`,
      warning ? `\n${warning}` : "",
      cascade ? "\nRelated projects, invoices, proposals, and message threads will also be removed." : "",
      requireDeleteWord
        ? `\nType DELETE to confirm.`
        : `\nType "${confirmName}" or DELETE to confirm.`,
    ];

    const typed = window.prompt(promptLines.filter(Boolean).join("\n"));
    if (typed == null) return;

    const normalized = typed.trim();
    const ok = requireDeleteWord
      ? normalized === "DELETE"
      : normalized === "DELETE" || normalized.toLowerCase() === confirmName.trim().toLowerCase();

    if (!ok) {
      window.alert(requireDeleteWord ? 'Confirmation failed. Type DELETE exactly.' : `Confirmation failed. Type "${expected}" or DELETE.`);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: normalized, cascade }),
      });
      const result = await response.json().catch(() => ({
        success: false,
        message: `Unable to delete ${entityLabel}.`,
      }));

      if (!response.ok || !result.success) {
        const dependents = Array.isArray(result.dependents) ? `\n\n${result.dependents.join("\n")}` : "";
        window.alert(`${result.message ?? `Unable to delete ${entityLabel}.`}${dependents}`);
        return;
      }

      window.alert(result.message ?? `${entityLabel} deleted.`);
      window.location.href = redirectTo;
    } finally {
      setBusy(false);
    }
  }

  if (variant === "button") {
    return (
      <button className="btn btn-light" disabled={busy} onClick={() => void runDelete()} type="button">
        {busy ? "Deleting..." : buttonLabel}
      </button>
    );
  }

  return (
    <QueueItemActions
      actions={[
        {
          label: busy ? "Deleting..." : buttonLabel,
          onSelect: runDelete,
          disabled: busy,
          destructive: true,
        },
      ]}
    />
  );
}

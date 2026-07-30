"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type BulkDeleteLeadRow = {
  id: string;
  name: string;
  email: string;
};

export function BulkDeleteTestLeads({
  leads,
  redirectTo = "/admin/leads?filter=test",
}: {
  leads: BulkDeleteLeadRow[];
  redirectTo?: string;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(leads.map((lead) => [lead.id, true])),
  );
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(
    () => leads.filter((lead) => selected[lead.id]).map((lead) => lead.id),
    [leads, selected],
  );

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(leads.map((lead) => [lead.id, next])));
  }

  async function runBulkDelete() {
    if (!selectedIds.length || busy) return;

    const typed = window.prompt(
      `Permanently delete ${selectedIds.length} selected test lead(s)?\n\nThis cannot be undone.\nType DELETE to confirm.`,
    );
    if (typed == null) return;
    if (typed.trim() !== "DELETE") {
      window.alert('Confirmation failed. Type DELETE exactly.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, confirm: "DELETE" }),
      });
      const result = await response.json().catch(() => ({
        success: false,
        message: "Unable to delete selected leads.",
      }));

      if (!response.ok || !result.success) {
        window.alert(result.message ?? "Unable to delete selected leads.");
        return;
      }

      window.alert(result.message ?? "Selected leads deleted.");
      window.location.href = redirectTo;
    } finally {
      setBusy(false);
    }
  }

  if (!leads.length) return null;

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>Clean up test leads</h2>
      <p className="mini-meta">
        Only consultation requests matching e2e. emails or E2E / FullFlow / Audit name patterns are listed.
      </p>
      <div className="topbar-actions" style={{ marginBottom: 12 }}>
        <Button type="button" variant="light" onClick={() => toggleAll(true)}>
          Select all
        </Button>
        <Button type="button" variant="light" onClick={() => toggleAll(false)}>
          Clear
        </Button>
        <Button disabled={busy || !selectedIds.length} type="button" variant="light" onClick={() => void runBulkDelete()}>
          {busy ? "Deleting..." : `Delete selected (${selectedIds.length})`}
        </Button>
      </div>
      <ul className="list">
        {leads.map((lead) => (
          <li key={lead.id}>
            <label className="check-row" style={{ width: "100%" }}>
              <input
                checked={Boolean(selected[lead.id])}
                onChange={(event) => setSelected((current) => ({ ...current, [lead.id]: event.target.checked }))}
                type="checkbox"
              />
              <span>
                <strong>{lead.name}</strong>
                <span className="mini-meta" style={{ display: "block" }}>
                  {lead.email || "No email"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

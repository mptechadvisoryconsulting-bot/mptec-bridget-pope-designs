"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type BulkDeleteClientRow = {
  id: string;
  name: string;
  email: string;
  projectCount: number;
};

export function BulkDeleteTestClients({
  clients,
  redirectTo = "/admin/clients?filter=test",
}: {
  clients: BulkDeleteClientRow[];
  redirectTo?: string;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map((client) => [client.id, true])),
  );
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(
    () => clients.filter((client) => selected[client.id]).map((client) => client.id),
    [clients, selected],
  );

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(clients.map((client) => [client.id, next])));
  }

  async function runBulkDelete() {
    if (!selectedIds.length || busy) return;

    const typed = window.prompt(
      `Permanently delete ${selectedIds.length} selected test client(s) and related projects?\n\nThis cannot be undone.\nType DELETE to confirm.`,
    );
    if (typed == null) return;
    if (typed.trim() !== "DELETE") {
      window.alert('Confirmation failed. Type DELETE exactly.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/clients/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, confirm: "DELETE", cascade: true }),
      });
      const result = await response.json().catch(() => ({
        success: false,
        message: "Unable to delete selected clients.",
      }));

      if (!response.ok || !result.success) {
        window.alert(result.message ?? "Unable to delete selected clients.");
        return;
      }

      window.alert(result.message ?? "Selected clients deleted.");
      window.location.href = redirectTo;
    } finally {
      setBusy(false);
    }
  }

  if (!clients.length) return null;

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>Clean up test clients</h2>
      <p className="mini-meta">
        Only rows matching e2e. emails or E2E / FullFlow / Audit name patterns are listed. Ordinary clients are never
        included.
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
        {clients.map((client) => (
          <li key={client.id}>
            <label className="check-row" style={{ width: "100%" }}>
              <input
                checked={Boolean(selected[client.id])}
                onChange={(event) => setSelected((current) => ({ ...current, [client.id]: event.target.checked }))}
                type="checkbox"
              />
              <span>
                <strong>{client.name}</strong>
                <span className="mini-meta" style={{ display: "block" }}>
                  {client.email || "No email"}
                  {client.projectCount ? ` · ${client.projectCount} project(s)` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

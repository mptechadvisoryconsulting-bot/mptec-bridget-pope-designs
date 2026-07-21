"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; clientId: string; name: string };

export function ImportInvoicePdfForm({
  clients,
  projects,
  framed = true,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  /** When false, render form fields only (parent supplies the panel chrome). */
  framed?: boolean;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const filteredProjects = useMemo(() => projects.filter((project) => project.clientId === clientId), [clientId, projects]);
  const [projectId, setProjectId] = useState(filteredProjects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const effectiveProjectId = filteredProjects.some((project) => project.id === projectId)
    ? projectId
    : filteredProjects[0]?.id ?? "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("clientId", clientId);
    data.set("projectId", effectiveProjectId);

    try {
      const response = await fetch("/api/invoices/import", { method: "POST", body: data });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Unable to import invoice.");
        return;
      }
      form.reset();
      if (result.invoice?.id) {
        window.location.href = `/admin/invoices/${result.invoice.id}`;
        return;
      }
      setMessage(result.message ?? "Invoice imported.");
      router.refresh();
    } catch {
      setMessage("Unable to reach the import service.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form className="import-pdf-form" onSubmit={onSubmit}>
      {framed ? <p className="mini-meta">Upload an existing PDF to create an invoice record with optional total and due date.</p> : null}
      <label className="field">
        <span>Client</span>
        <select className="input" onChange={(event) => setClientId(event.target.value)} required value={clientId}>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Project</span>
        <select
          className="input"
          onChange={(event) => setProjectId(event.target.value)}
          required
          value={effectiveProjectId}
        >
          {filteredProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Description</span>
        <input className="input" defaultValue="Imported invoice PDF" name="description" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Total (optional)</span>
          <input className="input" defaultValue="0" min="0" name="total" step="0.01" type="number" />
        </label>
        <label className="field">
          <span>Due date (optional)</span>
          <input className="input" name="dueDate" type="date" />
        </label>
      </div>
      <input accept="application/pdf,.pdf" className="input" name="file" required type="file" />
      <label className="mini-meta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input name="markSent" type="checkbox" value="true" />
        Mark as sent (visible in client portal)
      </label>
      <Button disabled={busy || !clientId || !effectiveProjectId} type="submit" variant="secondary">
        {busy ? "Importing..." : "Import PDF"}
      </Button>
      {message ? (
        <p className={message.toLowerCase().includes("unable") ? "form-error" : "form-success"}>{message}</p>
      ) : null}
    </form>
  );

  if (!framed) return form;

  return (
    <section className="panel" id="import-invoice-pdf">
      <h2>Import Invoice PDF</h2>
      {form}
    </section>
  );
}

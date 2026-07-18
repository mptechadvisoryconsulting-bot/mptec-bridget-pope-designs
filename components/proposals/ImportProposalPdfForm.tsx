"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ProjectOption = { id: string; name: string };

export function ImportProposalPdfForm({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("projectId", projectId);

    try {
      const response = await fetch("/api/proposals/import", { method: "POST", body: data });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Unable to import proposal.");
        return;
      }
      form.reset();
      if (result.proposal?.id) {
        window.location.href = `/admin/proposals/${result.proposal.id}`;
        return;
      }
      setMessage(result.message ?? "Proposal imported.");
      router.refresh();
    } catch {
      setMessage("Unable to reach the import service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" id="import-proposal-pdf">
      <h2>Import Proposal PDF</h2>
      <p className="mini-meta">Upload an existing proposal PDF to create a record with optional title and total.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label className="field">
          <span>Project</span>
          <select className="input" onChange={(event) => setProjectId(event.target.value)} required value={projectId}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Title</span>
          <input className="input" defaultValue="Imported Proposal" name="title" />
        </label>
        <label className="field">
          <span>Introduction (optional)</span>
          <textarea className="input" name="introduction" rows={3} />
        </label>
        <label className="field">
          <span>Total (optional)</span>
          <input className="input" defaultValue="0" min="0" name="total" step="0.01" type="number" />
        </label>
        <input accept="application/pdf,.pdf" className="input" name="file" required type="file" />
        <label className="mini-meta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input name="markSent" type="checkbox" value="true" />
          Mark as sent (visible in client portal)
        </label>
        <Button disabled={busy || !projectId} type="submit" variant="secondary">
          {busy ? "Importing..." : "Import PDF"}
        </Button>
        {message ? (
          <p className={message.toLowerCase().includes("unable") ? "form-error" : "form-success"}>{message}</p>
        ) : null}
      </form>
    </section>
  );
}

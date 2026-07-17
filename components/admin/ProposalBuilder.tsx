"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProjectOption = { id: string; event_name: string; client_id?: string | null };
type LineItem = { title: string; description: string; quantity: string; unitPrice: string };

export function ProposalBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState("Event Design Proposal");
  const [introduction, setIntroduction] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ title: "", description: "", quantity: "1", unitPrice: "" }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/projects/options")
      .then((response) => response.json())
      .then((result) => {
        if (Array.isArray(result.projects)) setProjects(result.projects);
        else if (Array.isArray(result)) setProjects(result);
      })
      .catch(() => {
        // Fallback: load from proposals page context is optional.
      });
  }, []);

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId);
  }, [initialProjectId]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const createResponse = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          introduction: introduction || undefined,
        }),
      });
      const created = await createResponse.json().catch(() => ({ success: false, message: "Invalid response." }));
      if (!createResponse.ok || !created.success || !created.proposal?.id) {
        setMessage(created.message ?? "Unable to create proposal.");
        return;
      }

      const proposalId = created.proposal.id as string;
      const validItems = items.filter((item) => item.title.trim());
      if (validItems.length) {
        const itemsResponse = await fetch(`/api/proposals/${proposalId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: validItems.map((item, index) => ({
              title: item.title.trim(),
              description: item.description.trim() || undefined,
              quantity: Number(item.quantity || 1),
              unitPrice: Number(item.unitPrice || 0),
              sortOrder: index,
            })),
          }),
        });
        const itemsResult = await itemsResponse.json().catch(() => ({ success: false }));
        if (!itemsResponse.ok || itemsResult.success === false) {
          setMessage(itemsResult.message ?? "Proposal created, but line items could not be saved.");
          router.push(`/admin/proposals/${proposalId}`);
          return;
        }
      }

      router.push(`/admin/proposals/${proposalId}`);
    } catch {
      setMessage("Unable to create proposal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Proposal Builder</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <label>
          <span className="mini-meta">Project</span>
          <select className="input" onChange={(event) => setProjectId(event.target.value)} required value={projectId}>
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.event_name}
              </option>
            ))}
          </select>
        </label>
        {!projects.length ? (
          <p className="mini-meta">
            If the project list is empty, open a project and use <strong>Create Proposal</strong>, or paste a project id via
            the URL (`?projectId=`).
          </p>
        ) : null}
        <label>
          <span className="mini-meta">Title</span>
          <input className="input" onChange={(event) => setTitle(event.target.value)} required value={title} />
        </label>
        <label>
          <span className="mini-meta">Introduction</span>
          <textarea className="input" onChange={(event) => setIntroduction(event.target.value)} rows={3} value={introduction} />
        </label>

        <div>
          <div className="section-heading">
            <h3 style={{ margin: 0, fontSize: 16 }}>Line Items</h3>
            <Button
              onClick={() => setItems((current) => [...current, { title: "", description: "", quantity: "1", unitPrice: "" }])}
              type="button"
              variant="light"
            >
              <Plus size={15} /> Add Item
            </Button>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {items.map((item, index) => (
              <div key={index} style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 2fr 0.7fr 0.9fr auto" }}>
                <input
                  className="input"
                  onChange={(event) => updateItem(index, { title: event.target.value })}
                  placeholder="Title"
                  value={item.title}
                />
                <input
                  className="input"
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  placeholder="Description"
                  value={item.description}
                />
                <input
                  className="input"
                  onChange={(event) => updateItem(index, { quantity: event.target.value })}
                  placeholder="Qty"
                  value={item.quantity}
                />
                <input
                  className="input"
                  onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
                  placeholder="Unit price"
                  value={item.unitPrice}
                />
                <Button
                  onClick={() => setItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)))}
                  type="button"
                  variant="light"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button disabled={busy || !projectId} type="submit" variant="primary">
          {busy ? "Creating..." : "Create Proposal"}
        </Button>
        {message ? <p className="form-error">{message}</p> : null}
      </form>
    </section>
  );
}

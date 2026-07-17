"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { safeFetch } from "@/lib/safe-fetch";

export function DesignUpdateCreateForm({ projects }: { projects: Array<{ id: string; event_name?: string | null }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!projects.length) {
    return (
      <section className="panel">
        <h2>Create Design Update</h2>
        <p className="mini-meta">Create a project first, then you can share design updates with the client.</p>
      </section>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const result = await safeFetch<{ success?: boolean; message?: string }>("/api/design-updates", {
      method: "POST",
      body: {
        projectId: String(form.get("projectId") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        status: String(form.get("status") ?? "draft"),
        clientVisible: form.get("clientVisible") === "on",
        requiresClientAction: form.get("requiresClientAction") === "on",
        clientActionType: String(form.get("clientActionType") ?? "not_required"),
      },
    });

    setIsSaving(false);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.data?.message ?? result.message);
      return;
    }

    setIsError(false);
    setMessage("Design update created.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <section className="panel">
      <h2>Create Design Update</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        <Field label="Project" wide>
          <select className="input" defaultValue={projects[0]?.id} name="projectId" required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.event_name || project.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" wide>
          <Input name="title" placeholder="Centerpiece concept update" required />
        </Field>
        <Field label="Description" wide>
          <Textarea name="description" placeholder="Share the latest creative notes with the client." required rows={4} />
        </Field>
        <Field label="Status">
          <select className="input" defaultValue="draft" name="status">
            <option value="draft">Draft</option>
            <option value="shared">Shared</option>
            <option value="awaiting_feedback">Awaiting Feedback</option>
            <option value="approved">Approved</option>
            <option value="revision_requested">Revision Requested</option>
          </select>
        </Field>
        <Field label="Visible to client">
          <input name="clientVisible" type="checkbox" />
        </Field>
        <Field label="Client action required">
          <input name="requiresClientAction" type="checkbox" />
        </Field>
        <Field label="Action Type">
          <select className="input" defaultValue="design_feedback" name="clientActionType">
            <option value="design_approval">Design Approval</option>
            <option value="design_feedback">Design Feedback</option>
            <option value="information_requested">Information Requested</option>
            <option value="file_requested">File Requested</option>
            <option value="general">General</option>
          </select>
        </Field>
        <div className="wide">
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Create Update"}
          </Button>
          {message ? <p className={isError ? "form-error" : "form-success"}>{message}</p> : null}
        </div>
      </form>
    </section>
  );
}

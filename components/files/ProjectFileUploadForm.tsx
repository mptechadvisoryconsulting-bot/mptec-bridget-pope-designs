"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function ProjectFileUploadForm({
  projectId,
  projects,
  defaultCategory = "Inspiration",
  defaultVisibility = "client_upload",
  allowVisibilityChoice = false,
  title = "Upload a file",
}: {
  projectId?: string;
  projects?: Array<{ id: string; event_name?: string | null }>;
  defaultCategory?: string;
  defaultVisibility?: "client_visible" | "client_upload" | "private_admin";
  allowVisibilityChoice?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const resolvedProjectId = projectId ?? projects?.[0]?.id ?? "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    if (!form.get("projectId")) form.set("projectId", resolvedProjectId);

    const response = await fetch("/api/project-files", {
      method: "POST",
      body: form,
    });
    const payload = await response.json();

    setIsUploading(false);

    if (!response.ok) {
      setIsError(true);
      setMessage(payload.message ?? "Upload failed.");
      return;
    }

    setIsError(false);
    setMessage("File uploaded.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        {projects?.length ? (
          <Field label="Project" wide>
            <select className="input" defaultValue={resolvedProjectId} name="projectId" required>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.event_name || project.id}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input name="projectId" type="hidden" value={resolvedProjectId} />
        )}
        <Field label="Title">
          <Input name="title" placeholder="Mood board photo or document name" required />
        </Field>
        <Field label="Category">
          <Input defaultValue={defaultCategory} name="category" required />
        </Field>
        {allowVisibilityChoice ? (
          <Field label="Visibility">
            <select className="input" defaultValue={defaultVisibility} name="visibility">
              <option value="client_visible">Visible to client</option>
              <option value="client_upload">Client upload</option>
              <option value="private_admin">Admin only</option>
            </select>
          </Field>
        ) : (
          <input name="visibility" type="hidden" value={defaultVisibility} />
        )}
        <Field label="File" wide>
          <Input accept="image/jpeg,image/png,image/webp,application/pdf" name="file" required type="file" />
        </Field>
        <div className="wide">
          <Button disabled={isUploading || !resolvedProjectId} type="submit">
            <Upload size={16} /> {isUploading ? "Uploading..." : "Upload"}
          </Button>
          {message ? <p className={isError ? "form-error" : "form-success"}>{message}</p> : null}
        </div>
      </form>
    </section>
  );
}

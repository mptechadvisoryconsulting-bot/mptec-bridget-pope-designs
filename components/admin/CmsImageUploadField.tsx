"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type CmsImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  help?: string;
  titleHint?: string;
};

export function CmsImageUploadField({ label, value, onChange, help, titleHint }: CmsImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", titleHint || label);
      form.set("category", "Website CMS");
      form.set("showOnHomepage", "0");
      form.set("isFeatured", "0");

      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.publicUrl) {
        setError(payload.message ?? "Upload failed.");
        return;
      }
      onChange(String(payload.publicUrl));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} wide>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Upload or paste an image URL" />
      <div className="topbar-actions" style={{ marginTop: 8 }}>
        <label className="btn btn-light" style={{ cursor: uploading ? "wait" : "pointer" }}>
          {uploading ? "Uploading..." : "Upload image"}
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            hidden
            onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {value ? (
          <Button type="button" variant="light" onClick={() => onChange("")}>
            Clear
          </Button>
        ) : null}
      </div>
      {help ? <p className="mini-meta" style={{ marginTop: 6 }}>{help}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={value} style={{ marginTop: 12, maxWidth: 280, maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
      ) : null}
    </Field>
  );
}

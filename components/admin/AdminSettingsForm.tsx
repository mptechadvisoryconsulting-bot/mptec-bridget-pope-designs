"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function AdminSettingsForm({ businessEmail }: { businessEmail: string }) {
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveSettings(formData: FormData) {
    setIsSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessEmail: String(formData.get("businessEmail") ?? "") }),
    });
    const payload = await response.json();

    setMessage(payload.success ? "Inquiry email saved." : payload.message ?? "Unable to save settings.");
    setIsSaving(false);
  }

  return (
    <form action={saveSettings} className="panel form-grid" style={{ gridTemplateColumns: "1fr" }}>
      <h2>Consultation Inquiry Email</h2>
      <p className="mini-meta">Landing-page consultation requests will send owner notifications to this address.</p>
      <Field label="Inquiry Recipient Email">
        <Input defaultValue={businessEmail} name="businessEmail" placeholder="inquiries@bridgetpopedesigns.com" required type="email" />
      </Field>
      {message ? <p className={message.includes("saved") ? "form-success" : "form-error"}>{message}</p> : null}
      <Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save Settings"}</Button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

export function UploadInvoicePdfForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/upload-pdf`, {
        method: "POST",
        body: data,
      });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Unable to upload PDF.");
        return;
      }
      setMessage(result.message ?? "PDF uploaded.");
      form.reset();
      router.refresh();
    } catch {
      setMessage("Unable to reach the upload service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" id="upload-invoice-pdf">
      <h2>Upload Invoice PDF</h2>
      <p className="mini-meta">Upload a branded PDF in addition to (or instead of) the generated invoice PDF.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <input accept="application/pdf,.pdf" className="input" name="file" required type="file" />
        <label className="mini-meta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input defaultChecked name="notify" type="checkbox" value="true" />
          Notify client by email when uploaded
        </label>
        <Button disabled={busy} type="submit" variant="secondary">
          {busy ? "Uploading..." : "Upload PDF"}
        </Button>
        {message ? (
          <p className={message.toLowerCase().includes("unable") ? "form-error" : "form-success"}>{message}</p>
        ) : null}
      </form>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function HoneyBookReferenceForm({
  projectId,
  clientId,
  initialHoneyBookUrl,
}: {
  projectId: string;
  clientId: string;
  initialHoneyBookUrl?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = {
      projectId,
      clientId,
      honeybookProjectId: String(form.get("honeybookProjectId") ?? ""),
      honeybookInvoiceNumber: String(form.get("honeybookInvoiceNumber") ?? ""),
      invoiceTotal: String(form.get("invoiceTotal") ?? ""),
      amountPaid: String(form.get("amountPaid") ?? ""),
      balanceRemaining: String(form.get("balanceRemaining") ?? ""),
      invoiceStatus: String(form.get("invoiceStatus") ?? ""),
      invoiceDate: String(form.get("invoiceDate") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      honeybookUrl: String(form.get("honeybookUrl") ?? ""),
      source: "manual",
    };

    try {
      const response = await fetch("/api/admin/honeybook/references", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));

      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Unable to save the HoneyBook reference.");
        return;
      }

      setMessage("HoneyBook reference saved.");
      router.refresh();
    } catch {
      setMessage("Unable to reach the HoneyBook reference service.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="HoneyBook Project ID">
        <Input name="honeybookProjectId" placeholder="Optional HoneyBook project ID" />
      </Field>
      <Field label="Invoice Number">
        <Input name="honeybookInvoiceNumber" placeholder="HoneyBook invoice/reference #" />
      </Field>
      <Field label="Invoice Total">
        <Input min="0" name="invoiceTotal" placeholder="0.00" step="0.01" type="number" />
      </Field>
      <Field label="Amount Paid">
        <Input min="0" name="amountPaid" placeholder="0.00" step="0.01" type="number" />
      </Field>
      <Field label="Balance Remaining">
        <Input min="0" name="balanceRemaining" placeholder="0.00" step="0.01" type="number" />
      </Field>
      <Field label="Status">
        <Input name="invoiceStatus" placeholder="Sent, paid, overdue..." />
      </Field>
      <Field label="Invoice Date">
        <Input name="invoiceDate" type="date" />
      </Field>
      <Field label="Due Date">
        <Input name="dueDate" type="date" />
      </Field>
      <Field label="HoneyBook URL" wide>
        <Input defaultValue={initialHoneyBookUrl ?? ""} name="honeybookUrl" placeholder="https://www.honeybook.com/..." />
      </Field>
      {message ? <p className={message.includes("saved") ? "form-success" : "form-error"}>{message}</p> : null}
      <div className="topbar-actions wide">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save HoneyBook Reference"}
        </Button>
      </div>
    </form>
  );
}

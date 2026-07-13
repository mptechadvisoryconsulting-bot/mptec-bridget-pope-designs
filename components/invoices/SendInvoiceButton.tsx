"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SendInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendInvoice() {
    setIsSending(true);
    setMessage("");

    const response = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
    const payload = await response.json();

    setMessage(payload.success ? `Invoice sent. Email status: ${payload.emailStatus}.` : payload.message ?? "Unable to send invoice.");
    setIsSending(false);
  }

  return (
    <div>
      <Button disabled={isSending} onClick={sendInvoice} type="button" variant="secondary">
        <Send size={16} /> {isSending ? "Sending..." : "Send Invoice"}
      </Button>
      {message ? <p className={message.startsWith("Invoice sent") ? "form-success" : "form-error"}>{message}</p> : null}
    </div>
  );
}

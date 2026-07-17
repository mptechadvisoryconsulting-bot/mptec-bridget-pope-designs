"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { safeFetch } from "@/lib/safe-fetch";

export function SendInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function sendInvoice() {
    setIsSending(true);
    setMessage("");

    const result = await safeFetch<{ success: boolean; message?: string; emailStatus?: string }>(`/api/invoices/${invoiceId}/send`, {
      method: "POST",
    });

    setIsSending(false);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.data?.message ?? result.message);
      return;
    }

    setIsError(false);
    setMessage(`Invoice sent. Email status: ${result.data?.emailStatus ?? "UNKNOWN"}.`);
  }

  return (
    <div>
      <Button disabled={isSending} onClick={sendInvoice} type="button" variant="secondary">
        <Send size={16} /> {isSending ? "Sending..." : "Send Invoice"}
      </Button>
      {message ? <p className={isError ? "form-error" : "form-success"}>{message}</p> : null}
    </div>
  );
}

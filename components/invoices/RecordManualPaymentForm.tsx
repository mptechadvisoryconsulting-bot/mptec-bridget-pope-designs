"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { safeFetch } from "@/lib/safe-fetch";
import {
  MANUAL_PAYMENT_METHODS,
  manualPaymentMethodLabels,
  type ManualPaymentMethod,
} from "@/lib/validation/manual-payment-schema";

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function RecordManualPaymentForm({
  balanceDue,
  invoiceId,
  invoiceStatus,
}: {
  balanceDue: number;
  invoiceId: string;
  invoiceStatus: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(balanceDue > 0 ? String(balanceDue) : "");
  const [paidAt, setPaidAt] = useState(todayInputValue());
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const blocked = ["cancelled", "refunded", "void"].includes(invoiceStatus) || balanceDue <= 0;
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (blocked) return;

    setIsSaving(true);
    setMessage("");

    const result = await safeFetch<{ success?: boolean; message?: string; invoice?: { status?: string; balance_due?: number } }>(
      `/api/invoices/${invoiceId}/payments`,
      {
        method: "POST",
        body: {
          amount: Number(amount),
          paidAt,
          paymentMethod,
          note,
        },
      },
    );

    setIsSaving(false);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.data?.message ?? result.message);
      return;
    }

    setIsError(false);
    setMessage(
      `Payment recorded. Invoice is now ${result.data?.invoice?.status ?? "updated"}` +
        (typeof result.data?.invoice?.balance_due === "number"
          ? ` with $${Number(result.data.invoice.balance_due).toFixed(2)} remaining.`
          : "."),
    );
    router.refresh();
  }

  if (blocked) {
    return (
      <section className="panel">
        <h2>Record Payment</h2>
        <p className="mini-meta" style={{ marginBottom: 0 }}>
          {balanceDue <= 0
            ? "This invoice has no remaining balance."
            : "Payments cannot be recorded on cancelled or refunded invoices."}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Record Payment</h2>
      <p className="mini-meta">
        Record cash, Zelle, check, Venmo, or other offline payments. The client dashboard updates automatically.
      </p>
      <form className="form-grid" onSubmit={onSubmit}>
        <Field label="Amount">
          <Input
            inputMode="decimal"
            max={balanceDue}
            min="0.01"
            onChange={(event) => setAmount(event.target.value)}
            required
            step="0.01"
            type="number"
            value={amount}
          />
        </Field>
        <Field label="Payment date">
          <Input onChange={(event) => setPaidAt(event.target.value)} required type="date" value={paidAt} />
        </Field>
        <Field label="Payment method">
          <select
            className="input"
            onChange={(event) => setPaymentMethod(event.target.value as ManualPaymentMethod)}
            required
            value={paymentMethod}
          >
            {MANUAL_PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {manualPaymentMethodLabels[method]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)" wide>
          <Input
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Check #, confirmation, or memo"
            value={note}
          />
        </Field>
        <div className="wide">
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Record Payment"}
          </Button>
          <p className="mini-meta" style={{ marginTop: 8, marginBottom: 0 }}>
            Remaining balance: ${balanceDue.toFixed(2)}
          </p>
          {message ? <p className={isError ? "form-error" : "form-success"}>{message}</p> : null}
        </div>
      </form>
    </section>
  );
}

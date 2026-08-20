"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, MessageSquareText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientProposalResponseActions({
  proposalId,
  status,
}: {
  proposalId: string;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const actionable = status === "sent" || status === "viewed";

  async function approve() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}/approve`, { method: "POST" });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid response." }));
      if (!response.ok || !result.success) {
        setError(result.message ?? "Unable to approve the proposal.");
        return;
      }
      setMessage("Proposal approved. Bridget Pope Designs has been notified.");
      router.refresh();
    } catch {
      setError("Unable to approve the proposal.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(action: "changes_requested" | "rejected", responseNote?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: responseNote || undefined }),
      });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid response." }));
      if (!response.ok || !result.success) {
        setError(result.message ?? "Unable to save your response.");
        return;
      }
      setMessage(
        action === "changes_requested"
          ? "Your requested changes were sent to Bridget Pope Designs. You can continue the conversation in Messages."
          : "The proposal was declined and Bridget Pope Designs has been notified.",
      );
      setMode("idle");
      setNote("");
      router.refresh();
    } catch {
      setError("Unable to save your response.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    return <p className="mini-meta">You approved this proposal. The owner has been notified and the invoice will be prepared for review.</p>;
  }

  if (status === "changes_requested") {
    return <p className="mini-meta">Changes requested. Bridget Pope Designs has been notified. Use Messages if you want to continue discussing the revision.</p>;
  }

  if (status === "rejected") {
    return <p className="mini-meta">You declined this proposal. Contact Bridget Pope Designs if you would like to revisit it.</p>;
  }

  if (!actionable) {
    return <p className="mini-meta">This proposal is not currently awaiting a client response.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button disabled={busy} onClick={() => void approve()} type="button">
          <CheckCircle2 size={16} /> Approve Proposal
        </Button>
        <Button disabled={busy} onClick={() => setMode("changes")} type="button" variant="secondary">
          <MessageSquareText size={16} /> Request Changes
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            if (window.confirm("Decline this proposal? Bridget Pope Designs will be notified.")) {
              void respond("rejected");
            }
          }}
          type="button"
          variant="light"
        >
          <XCircle size={16} /> Decline
        </Button>
      </div>

      {mode === "changes" ? (
        <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
          <label>
            <span className="mini-meta">What would you like changed?</span>
            <textarea
              className="input"
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: Please remove the floral arch and update the centerpiece quantity."
              rows={4}
              value={note}
            />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button disabled={busy || note.trim().length < 3} onClick={() => void respond("changes_requested", note)} type="button">
              Send Change Request
            </Button>
            <Button disabled={busy} onClick={() => setMode("idle")} type="button" variant="quiet">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mini-meta">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PipelineAction } from "@/lib/admin/pipeline-constants";
import { pipelineStageLabels } from "@/lib/admin/pipeline-constants";

const actions: Array<{ action: PipelineAction; label: string; variant?: "primary" | "secondary" | "light" }> = [
  { action: "open_proposal", label: "Open Proposal Workspace", variant: "secondary" },
  { action: "proposal_sent", label: "Proposal Sent", variant: "light" },
  { action: "proposal_approved", label: "Proposal Approved", variant: "primary" },
  { action: "invoice_paid", label: "Invoice Paid", variant: "light" },
  { action: "project_started", label: "Project Started", variant: "light" },
];

export function ProjectPipelineActions({
  projectId,
  pipelineStage,
  proposalId,
  invoiceId,
  convertFirstHref,
}: {
  projectId?: string | null;
  pipelineStage?: string | null;
  proposalId?: string | null;
  invoiceId?: string | null;
  convertFirstHref?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<PipelineAction | null>(null);

  if (!projectId) {
    return (
      <div>
        <p className="mini-meta">Convert this lead to a client/project before using the sales pipeline.</p>
        {convertFirstHref ? (
          <div className="topbar-actions" style={{ marginTop: 12 }}>
            <a className="btn btn-secondary" href={convertFirstHref}>
              Convert to Client
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  async function runAction(action: PipelineAction) {
    setBusyAction(action);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/projects/${projectId}/pipeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          proposalId: proposalId || undefined,
          invoiceId: invoiceId || undefined,
        }),
      });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));

      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Unable to update pipeline.");
        return;
      }

      if (action === "open_proposal" && result.proposalUrl) {
        router.push(result.proposalUrl);
        return;
      }

      setMessage(result.message ?? "Pipeline updated.");
      router.refresh();
    } catch {
      setMessage("Unable to reach the pipeline service.");
    } finally {
      setBusyAction(null);
    }
  }

  const stageLabel =
    pipelineStage && pipelineStage in pipelineStageLabels
      ? pipelineStageLabels[pipelineStage as keyof typeof pipelineStageLabels]
      : pipelineStage ?? "Lead Received";

  return (
    <div>
      <p className="mini-meta">
        Current stage: <span className="status">{stageLabel}</span>
      </p>
      <div className="topbar-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {actions.map((item) => (
          <Button
            disabled={busyAction !== null}
            key={item.action}
            onClick={() => runAction(item.action)}
            type="button"
            variant={item.variant ?? "light"}
          >
            {busyAction === item.action ? "Working..." : item.label}
          </Button>
        ))}
      </div>
      {message ? <p className={message.toLowerCase().includes("unable") ? "form-error" : "form-success"} style={{ marginTop: 12 }}>{message}</p> : null}
    </div>
  );
}

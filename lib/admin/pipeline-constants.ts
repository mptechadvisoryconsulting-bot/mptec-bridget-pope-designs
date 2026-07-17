import { honeybookPipelineStages, type HoneyBookPipelineStage } from "@/lib/integrations/honeybook/types";

export const pipelineActions = [
  "open_honeybook",
  "proposal_sent",
  "proposal_approved",
  "invoice_paid",
  "project_started",
] as const;

export type PipelineAction = (typeof pipelineActions)[number];

export const pipelineStageLabels: Record<HoneyBookPipelineStage, string> = {
  lead_received: "Lead Received",
  consultation: "Consultation",
  proposal_draft: "Proposal Draft",
  honeybook_opened: "HoneyBook Opened",
  proposal_sent: "Proposal Sent",
  proposal_approved: "Proposal Approved",
  project_started: "Project Started",
  invoice_paid: "Invoice Paid",
  completed: "Completed",
};

export { honeybookPipelineStages };
export type { HoneyBookPipelineStage };

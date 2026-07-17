export const pipelineStages = [
  "lead_received",
  "consultation",
  "proposal_draft",
  "proposal_workspace",
  "proposal_sent",
  "proposal_approved",
  "project_started",
  "invoice_paid",
  "completed",
] as const;

export type PipelineStage = (typeof pipelineStages)[number];

export const pipelineActions = [
  "open_proposal",
  "proposal_sent",
  "proposal_approved",
  "invoice_paid",
  "project_started",
] as const;

export type PipelineAction = (typeof pipelineActions)[number];

export const pipelineStageLabels: Record<PipelineStage, string> = {
  lead_received: "Lead Received",
  consultation: "Consultation",
  proposal_draft: "Proposal Draft",
  proposal_workspace: "Proposal Workspace",
  proposal_sent: "Proposal Sent",
  proposal_approved: "Proposal Approved",
  project_started: "Project Started",
  invoice_paid: "Invoice Paid",
  completed: "Completed",
};

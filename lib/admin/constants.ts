export const projectStatuses = [
  "pending",
  "booked",
  "planning",
  "design_in_progress",
  "awaiting_client_approval",
  "finalizing",
  "ready_for_event",
  "event_complete",
  "closed",
  "cancelled",
] as const;

export const projectStatusLabels: Record<string, string> = {
  pending: "Pending",
  booked: "Booked",
  planning: "Planning",
  design_in_progress: "Design In Progress",
  awaiting_client_approval: "Awaiting Client Approval",
  finalizing: "Finalizing",
  ready_for_event: "Ready For Event",
  event_complete: "Event Complete",
  closed: "Closed",
  cancelled: "Cancelled",
};

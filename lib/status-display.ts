export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

/** Normalize DB / display strings to a lookup key without changing stored values. */
export function normalizeStatusKey(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const STATUS_LABELS: Record<string, string> = {
  // Leads
  new: "New",
  contacted: "Contacted",
  consultation_scheduled: "Consultation Scheduled",
  consultation_completed: "Consultation Completed",
  awaiting_business_approval: "Awaiting Business Approval",
  approved: "Approved",
  converted: "Client Created",
  declined: "Declined",
  lost: "Lost",
  archived: "Archived",
  // Projects / pipeline
  pending: "Pending",
  booked: "Booked",
  planning: "Planning",
  in_design: "In Design",
  awaiting_client_feedback: "Awaiting Feedback",
  final_details: "Final Details",
  install_ready: "Install Ready",
  complete: "Completed",
  completed: "Completed",
  // Invoices / payments
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially Paid",
  partial: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  refunded: "Refunded",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  void: "Void",
  voided: "Void",
  // Proposals / contracts / designs
  rejected: "Rejected",
  expired: "Expired",
  signed: "Signed",
  shared: "Shared",
  awaiting_feedback: "Awaiting Feedback",
  revision_requested: "Revision Requested",
  // Consultations / tasks / misc
  requested: "Requested",
  scheduled: "Scheduled",
  no_show: "No Show",
  open: "Open",
  active: "Active",
  inactive: "Inactive",
  read: "Read",
  unread: "Unread",
  feedback_needed: "Feedback Needed",
};

const STATUS_TONES: Record<string, StatusTone> = {
  new: "info",
  contacted: "info",
  consultation_scheduled: "info",
  consultation_completed: "success",
  awaiting_business_approval: "warning",
  approved: "success",
  converted: "success",
  declined: "danger",
  lost: "muted",
  archived: "muted",
  pending: "warning",
  booked: "success",
  planning: "info",
  in_design: "info",
  awaiting_client_feedback: "warning",
  final_details: "info",
  install_ready: "success",
  complete: "success",
  completed: "success",
  draft: "muted",
  sent: "info",
  viewed: "info",
  partially_paid: "warning",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  refunded: "muted",
  cancelled: "muted",
  canceled: "muted",
  void: "muted",
  voided: "muted",
  rejected: "danger",
  expired: "muted",
  signed: "success",
  shared: "info",
  awaiting_feedback: "warning",
  revision_requested: "warning",
  requested: "info",
  scheduled: "info",
  no_show: "danger",
  open: "info",
  active: "success",
  inactive: "muted",
  read: "muted",
  unread: "info",
  feedback_needed: "warning",
};

function titleCaseStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatStatusLabel(status: string): string {
  if (!status) return "Unknown";
  const key = normalizeStatusKey(status);
  return STATUS_LABELS[key] ?? titleCaseStatus(status);
}

export function statusTone(status: string): StatusTone {
  if (!status) return "neutral";
  return STATUS_TONES[normalizeStatusKey(status)] ?? "neutral";
}

export function statusBadgeClassName(status: string): string {
  return `status status-${statusTone(status)}`;
}

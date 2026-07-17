export const leadStatuses = [
  "New",
  "Contacted",
  "Consultation Scheduled",
  "Consultation Completed",
  "Awaiting Business Approval",
  "Approved",
  "Client Created",
  "Declined",
  "Lost",
  "Archived",
] as const;

export const projectStatuses = ["Planning", "In Design", "Awaiting Client Feedback", "Final Details", "Install Ready", "Complete"] as const;
export const invoiceStatuses = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"] as const;

import type { QueueAction } from "@/components/admin/QueueItemActions";

type LeadLike = {
  id: string;
  status: string;
};

function withStatus(href: string, statusFilter?: string) {
  if (!statusFilter) return href;
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}status=${statusFilter}`;
}

/** Status-aware primary + full secondary set for lead queue rows. */
export function getLeadQueueActions(lead: LeadLike, statusFilter?: string): {
  primaryAction: QueueAction;
  actions: QueueAction[];
} {
  const view: QueueAction = { label: "View details", href: `/admin/leads/${lead.id}` };
  const contacted: QueueAction = {
    label: "Mark contacted",
    href: withStatus(`/admin/leads?action=contacted&id=${lead.id}`, statusFilter),
  };
  const schedule: QueueAction = {
    label: "Schedule",
    href: withStatus(`/admin/leads?action=schedule&id=${lead.id}`, statusFilter),
  };
  const convert: QueueAction = {
    label: "Approve & create client",
    href: withStatus(`/admin/leads?action=convert&id=${lead.id}`, statusFilter),
  };
  const archive: QueueAction = {
    label: "Archive",
    href: withStatus(`/admin/leads?action=archive&id=${lead.id}`, statusFilter),
  };

  const actions = [view, contacted, schedule, convert, archive];

  let primaryAction = view;
  if (lead.status === "new") primaryAction = contacted;
  else if (lead.status === "contacted") primaryAction = schedule;
  else if (
    lead.status === "consultation_scheduled" ||
    lead.status === "consultation_completed" ||
    lead.status === "awaiting_business_approval" ||
    lead.status === "approved"
  ) {
    primaryAction = convert;
  }

  return { primaryAction, actions };
}

export function getLeadDetailActions(leadId: string, status: string): {
  primaryAction: QueueAction | null;
  actions: QueueAction[];
} {
  const contacted: QueueAction = { label: "Mark contacted", href: `/admin/leads/${leadId}?action=contacted` };
  const schedule: QueueAction = { label: "Schedule consultation", href: `/admin/leads/${leadId}?action=schedule` };
  const complete: QueueAction = {
    label: "Mark consultation complete",
    href: `/admin/leads/${leadId}?action=complete-consultation`,
  };
  const awaiting: QueueAction = {
    label: "Awaiting approval",
    href: `/admin/leads/${leadId}?action=awaiting-approval`,
  };
  const convert: QueueAction = { label: "Approve & create client", href: `/admin/leads/${leadId}?action=convert` };
  const decline: QueueAction = { label: "Decline", href: `/admin/leads/${leadId}?action=decline` };
  const lost: QueueAction = { label: "Mark lost", href: `/admin/leads/${leadId}?action=lost` };
  const archive: QueueAction = { label: "Archive", href: `/admin/leads/${leadId}?action=archive` };

  const terminal = status === "converted" || status === "archived";
  if (terminal) {
    return { primaryAction: null, actions: [] };
  }

  const actions = [contacted, schedule, complete, awaiting, convert, decline, lost, archive];

  let primaryAction: QueueAction = convert;
  if (status === "new") primaryAction = contacted;
  else if (status === "contacted") primaryAction = schedule;
  else if (status === "consultation_scheduled") primaryAction = complete;
  else if (status === "consultation_completed" || status === "awaiting_business_approval" || status === "approved") {
    primaryAction = convert;
  }

  return { primaryAction, actions };
}

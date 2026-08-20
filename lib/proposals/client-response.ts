import { z } from "zod";

export const clientProposalResponseSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("changes_requested"),
    note: z.string().trim().min(3, "Tell Bridget what you would like changed.").max(2000),
  }),
  z.object({
    action: z.literal("rejected"),
    note: z.string().trim().max(2000).optional(),
  }),
]);

const CLIENT_ACTIONABLE_STATUSES = new Set(["sent", "viewed", "changes_requested"]);

export function canClientActOnProposal(status: string | null | undefined) {
  return Boolean(status && CLIENT_ACTIONABLE_STATUSES.has(status));
}

export function proposalResponseLabel(status: string | null | undefined) {
  switch (status) {
    case "changes_requested":
      return "Changes Requested";
    case "rejected":
      return "Declined";
    default:
      return null;
  }
}

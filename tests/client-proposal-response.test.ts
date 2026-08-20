import { describe, expect, it } from "vitest";
import { canClientActOnProposal, clientProposalResponseSchema, proposalResponseLabel } from "@/lib/proposals/client-response";

describe("client proposal responses", () => {
  it("allows clients to act only on proposals awaiting a response", () => {
    expect(canClientActOnProposal("sent")).toBe(true);
    expect(canClientActOnProposal("viewed")).toBe(true);
    expect(canClientActOnProposal("changes_requested")).toBe(true);
    expect(canClientActOnProposal("approved")).toBe(false);
    expect(canClientActOnProposal("rejected")).toBe(false);
    expect(canClientActOnProposal("expired")).toBe(false);
    expect(canClientActOnProposal("cancelled")).toBe(false);
  });

  it("requires a meaningful note when requesting changes", () => {
    expect(clientProposalResponseSchema.safeParse({ action: "changes_requested", note: "" }).success).toBe(false);
    expect(clientProposalResponseSchema.safeParse({ action: "changes_requested", note: "  " }).success).toBe(false);
    expect(clientProposalResponseSchema.safeParse({ action: "changes_requested", note: "Please remove the floral arch." }).success).toBe(true);
  });

  it("allows a decline without forcing the client to write a reason", () => {
    expect(clientProposalResponseSchema.safeParse({ action: "rejected" }).success).toBe(true);
  });

  it("uses clear owner-facing response labels", () => {
    expect(proposalResponseLabel("changes_requested")).toBe("Changes Requested");
    expect(proposalResponseLabel("rejected")).toBe("Declined");
  });
});

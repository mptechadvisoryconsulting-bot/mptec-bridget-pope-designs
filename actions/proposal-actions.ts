"use server";

export async function approveProposal(proposalId: string) {
  return { proposalId, status: "approved" };
}

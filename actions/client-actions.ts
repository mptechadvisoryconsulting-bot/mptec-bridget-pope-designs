"use server";

export async function convertLeadToClient(leadId: string) {
  return {
    success: false,
    leadId,
    message: "Client conversion must run through the authenticated admin workflow.",
  };
}

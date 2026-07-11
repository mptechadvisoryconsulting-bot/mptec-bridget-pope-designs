"use server";

export async function convertLeadToClient(leadId: string) {
  return { clientId: "client_demo", leadId };
}

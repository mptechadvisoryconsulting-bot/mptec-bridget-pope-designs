"use server";

export async function signContract(contractId: string) {
  return { contractId, status: "signed" };
}

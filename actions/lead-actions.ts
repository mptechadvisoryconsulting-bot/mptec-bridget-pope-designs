"use server";

export async function createLead(formData: FormData) {
  return { id: "lead_demo", name: String(formData.get("name") ?? "") };
}

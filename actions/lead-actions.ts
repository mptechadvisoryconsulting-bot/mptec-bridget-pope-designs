"use server";

export async function createLead(formData: FormData) {
  return {
    success: false,
    name: String(formData.get("name") ?? ""),
    message: "Use /api/inquiries so the lead, notifications, PDF summary, and emails stay synchronized.",
  };
}

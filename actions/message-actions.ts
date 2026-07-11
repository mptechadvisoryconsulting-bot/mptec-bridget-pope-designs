"use server";

export async function sendMessage(conversationId: string, text: string) {
  return { conversationId, text, status: "sent" };
}

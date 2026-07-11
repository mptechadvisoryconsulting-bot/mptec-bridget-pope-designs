import { z } from "zod";

export const messageSchema = z.object({
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  attachmentFileId: z.string().uuid().optional(),
});

import { z } from "zod";

export const fileSchema = z.object({
  projectId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  uploadedBy: z.string().uuid(),
  category: z.string().min(2).max(100),
  fileName: z.string().min(2).max(200),
  storagePath: z.string().min(2).max(500),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  fileSize: z.number().int().positive().max(15 * 1024 * 1024),
  visibility: z.enum(["private_admin", "client_visible", "client_upload", "public_gallery"]),
});

import type { createAdminClient } from "@/lib/supabase/admin";

type FileLike = {
  storage_path?: string | null;
  visibility?: string | null;
  category?: string | null;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function resolveFileUrl(supabase: SupabaseAdmin, file: FileLike, expiresIn = 3600) {
  const path = file.storage_path?.trim();
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;

  if (file.visibility === "public_gallery") {
    const { data } = supabase.storage.from("event-gallery").getPublicUrl(path);
    return data.publicUrl;
  }

  const buckets =
    file.category === "inquiry_pdf"
      ? ["inquiry-pdfs", "project-files", "event-gallery"]
      : ["project-files", "inquiry-pdfs", "event-gallery"];

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return null;
}

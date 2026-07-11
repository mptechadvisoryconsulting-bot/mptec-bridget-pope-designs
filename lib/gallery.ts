import { galleryItems } from "@/lib/data";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseBucket } from "@/lib/supabase/namespace";

export type PublicGalleryItem = {
  id: string;
  title: string;
  category: string;
  image: string;
  createdAt?: string;
};

function publicStorageUrl(storagePath: string) {
  if (storagePath.startsWith("http") || storagePath.startsWith("/")) {
    return storagePath;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = mapSupabaseBucket(process.env.NEXT_PUBLIC_GALLERY_BUCKET ?? "event-gallery");

  if (!supabaseUrl) {
    return storagePath;
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

export function fallbackGalleryItems(): PublicGalleryItem[] {
  return galleryItems.map((item) => ({
    id: item.title,
    title: item.title,
    category: item.category,
    image: item.image,
  }));
}

export async function getPublicGalleryItems(limit = 24): Promise<PublicGalleryItem[]> {
  if (!hasSupabaseAdminEnv()) {
    return fallbackGalleryItems();
  }

  const { data, error } = await createAdminClient()
    .from("files")
    .select("id,file_name,category,storage_path,created_at")
    .eq("visibility", "public_gallery")
    .ilike("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    return fallbackGalleryItems();
  }

  return data.map((file) => ({
    id: file.id,
    title: file.file_name,
    category: file.category ?? "Event Design",
    image: publicStorageUrl(file.storage_path),
    createdAt: file.created_at,
  }));
}

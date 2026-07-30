import { unstable_noStore as noStore } from "next/cache";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseBucket } from "@/lib/supabase/namespace";

export type PublicGalleryItem = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  image: string;
  storagePath?: string;
  createdAt?: string;
  sortOrder?: number;
  showOnHomepage?: boolean;
  isFeatured?: boolean;
  isVisible?: boolean;
};

export type GalleryQueryOptions = {
  /** Homepage strip — only items with show_on_homepage. */
  homepageOnly?: boolean;
  /** Featured Designs section. */
  featuredOnly?: boolean;
  /** Include hidden library items (admin). */
  includeHidden?: boolean;
  limit?: number;
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

function mapRow(file: {
  id: string;
  title?: string | null;
  file_name: string;
  category?: string | null;
  description?: string | null;
  storage_path: string;
  created_at?: string;
  sort_order?: number | null;
  show_on_homepage?: boolean | null;
  is_featured?: boolean | null;
  is_visible?: boolean | null;
}): PublicGalleryItem {
  return {
    id: file.id,
    title: file.title?.trim() || file.file_name,
    category: file.category ?? "Event Design",
    description: file.description ?? null,
    image: publicStorageUrl(file.storage_path),
    storagePath: file.storage_path,
    createdAt: file.created_at,
    sortOrder: file.sort_order ?? 0,
    showOnHomepage: Boolean(file.show_on_homepage),
    isFeatured: Boolean(file.is_featured),
    isVisible: file.is_visible !== false,
  };
}

/** Public + admin gallery photos from DB only — no static stock fallbacks. */
export async function getPublicGalleryItems(
  limitOrOptions: number | GalleryQueryOptions = 24,
  maybeOptions: GalleryQueryOptions = {},
): Promise<PublicGalleryItem[]> {
  noStore();

  const options: GalleryQueryOptions =
    typeof limitOrOptions === "number" ? { ...maybeOptions, limit: limitOrOptions } : { ...limitOrOptions, ...maybeOptions };

  const limit = options.limit ?? 24;

  if (!hasSupabaseAdminEnv()) {
    return [];
  }

  let query = createAdminClient()
    .from("files")
    .select(
      "id,title,file_name,category,description,storage_path,created_at,sort_order,show_on_homepage,is_featured,is_visible,mime_type,visibility",
    )
    .eq("visibility", "public_gallery")
    .ilike("mime_type", "image/%")
    .like("storage_path", "gallery/%");

  if (!options.includeHidden) {
    query = query.eq("is_visible", true);
  }
  if (options.homepageOnly) {
    query = query.eq("show_on_homepage", true);
  }
  if (options.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  const { data, error } = await query.order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(limit);

  if (error || !data?.length) {
    return [];
  }

  return data.map(mapRow);
}

/** @deprecated Prefer getPublicGalleryItems with empty-state UI — kept for any legacy callers. */
export function fallbackGalleryItems(): PublicGalleryItem[] {
  return [];
}

export async function getAdminGalleryItems(limit = 200): Promise<PublicGalleryItem[]> {
  return getPublicGalleryItems({ limit, includeHidden: true });
}

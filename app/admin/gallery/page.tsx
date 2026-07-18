import { AdminGalleryManager } from "@/components/admin/AdminGalleryManager";
import { getPublicGalleryItems } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const items = await getPublicGalleryItems(48, { allowFallback: false });
  return <AdminGalleryManager initialItems={items} />;
}

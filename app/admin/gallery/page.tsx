import { AdminGalleryManager } from "@/components/admin/AdminGalleryManager";
import { getPublicGalleryItems } from "@/lib/gallery";

export default async function AdminGalleryPage() {
  const items = await getPublicGalleryItems();
  return <AdminGalleryManager initialItems={items} />;
}

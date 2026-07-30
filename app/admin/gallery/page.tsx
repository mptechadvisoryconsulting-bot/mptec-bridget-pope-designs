import { AdminGalleryManager } from "@/components/admin/AdminGalleryManager";
import { getAdminGalleryItems } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const items = await getAdminGalleryItems(200);
  return <AdminGalleryManager initialItems={items} />;
}

import { AdminWebsiteContentManager } from "@/components/admin/AdminWebsiteContentManager";
import { getWebsiteContent } from "@/lib/website/content";

export const dynamic = "force-dynamic";

export default async function AdminWebsitePage() {
  const content = await getWebsiteContent();
  return <AdminWebsiteContentManager initialContent={content} />;
}

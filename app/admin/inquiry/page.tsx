import { AdminInquiryManager } from "@/components/admin/AdminInquiryManager";
import { getInquiryContent } from "@/lib/website/inquiry-content";

export const dynamic = "force-dynamic";

export default async function AdminInquiryPage() {
  return <AdminInquiryManager initialContent={await getInquiryContent()} />;
}

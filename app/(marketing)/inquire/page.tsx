import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";
import { InquiryForm } from "@/components/marketing/InquiryForm";
import { getInquiryContent } from "@/lib/website/inquiry-content";

export const dynamic = "force-dynamic";

export default async function InquirePage() {
  const config = await getInquiryContent();
  return (
    <div className="page-shell">
      <MarketingHeader />
      <InquiryForm config={config} />
      <Footer />
    </div>
  );
}

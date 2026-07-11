import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";
import { InquiryForm } from "@/components/marketing/InquiryForm";

export default function InquirePage() {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <InquiryForm />
      <Footer />
    </div>
  );
}

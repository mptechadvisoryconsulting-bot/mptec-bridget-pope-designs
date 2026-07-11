import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";

export default function FAQPage() {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <FAQ />
      <Footer />
    </div>
  );
}

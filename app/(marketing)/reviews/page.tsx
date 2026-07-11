import { Testimonials } from "@/components/marketing/Testimonials";
import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";

export default function ReviewsPage() {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <Testimonials />
      <Footer />
    </div>
  );
}

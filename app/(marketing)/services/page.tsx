import { ServiceCatalog } from "@/components/marketing/Services";
import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";

export default function ServicesPage() {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <ServiceCatalog />
      <Footer />
    </div>
  );
}

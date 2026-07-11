import { Gallery } from "@/components/marketing/Gallery";
import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";

export default function GalleryPage() {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <Gallery />
      <Footer />
    </div>
  );
}

import { Gallery } from "@/components/marketing/Gallery";
import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";

export const dynamic = "force-dynamic";

export default function GalleryPage() {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <Gallery />
      <Footer />
    </div>
  );
}

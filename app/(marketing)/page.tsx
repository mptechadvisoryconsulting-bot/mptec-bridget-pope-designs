import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";
import { Gallery } from "@/components/marketing/Gallery";
import { Hero } from "@/components/marketing/Hero";
import { Services } from "@/components/marketing/Services";

export default function HomePage() {
  return (
    <div className="page-shell">
      <Hero />
      <Services />
      <Gallery />
      <FAQ />
      <Footer showCta={false} />
    </div>
  );
}

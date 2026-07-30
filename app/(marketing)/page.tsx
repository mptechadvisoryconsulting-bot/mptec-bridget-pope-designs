import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";
import { Gallery } from "@/components/marketing/Gallery";
import { Hero } from "@/components/marketing/Hero";
import { MeetBridget } from "@/components/marketing/MeetBridget";
import { Services } from "@/components/marketing/Services";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="page-shell">
      <Hero />
      <Services />
      <MeetBridget />
      <Gallery mode="homepage" limit={8} />
      <FAQ />
      <Footer showCta={false} />
    </div>
  );
}

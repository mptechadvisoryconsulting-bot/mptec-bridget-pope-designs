import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";
import { Gallery } from "@/components/marketing/Gallery";
import { Hero } from "@/components/marketing/Hero";
import { InquiryForm } from "@/components/marketing/InquiryForm";
import { Services } from "@/components/marketing/Services";
import { Testimonials } from "@/components/marketing/Testimonials";

export default function HomePage() {
  return (
    <div className="page-shell">
      <Hero />
      <Services />
      <Gallery />
      <Testimonials />
      <FAQ />
      <InquiryForm />
      <Footer />
    </div>
  );
}

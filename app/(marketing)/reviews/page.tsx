import { Testimonials } from "@/components/marketing/Testimonials";
import { Footer } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/Hero";
import { getWebsiteSection } from "@/lib/website/content";

export default async function ReviewsPage() {
  const content = await getWebsiteSection("testimonials");

  return (
    <div className="page-shell">
      <MarketingHeader />
      {content.enabled ? (
        <Testimonials />
      ) : (
        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">{content.eyebrow}</span>
              <h2>{content.heading}</h2>
            </div>
            <p className="mini-meta">Client reviews will be shared here soon.</p>
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}

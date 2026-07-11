import { MarketingPage } from "@/components/marketing/MarketingPage";

export default function AboutPage() {
  return (
    <MarketingPage eyebrow="About Bridget Pope Designs" title="Luxury Design With Calm Execution">
      <div className="placeholder-grid">
        <section className="placeholder-hero">
          <h1>Design, planning, and production in one polished process.</h1>
          <p className="mini-meta">
            Bridget Pope Designs brings intentional room styling, custom installations, proposal clarity, payment automation,
            and client communication into one elegant experience.
          </p>
        </section>
        <img className="card" src="/images/gallery-gold.png" alt="Luxury event table styling" style={{ height: "100%", objectFit: "cover", width: "100%" }} />
      </div>
    </MarketingPage>
  );
}

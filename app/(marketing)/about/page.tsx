import { MarketingPage } from "@/components/marketing/MarketingPage";
import { getWebsiteSection } from "@/lib/website/content";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const about = await getWebsiteSection("about");

  return (
    <MarketingPage eyebrow={about.eyebrow} title={about.heading}>
      <div className="placeholder-grid">
        <section className="placeholder-hero">
          <h1>{about.heading}</h1>
          <p className="mini-meta">{about.biography}</p>
          {about.signature ? <p className="script" style={{ marginTop: 18 }}>{about.signature}</p> : null}
        </section>
        <img
          className="card"
          src={about.portraitImage || "/images/gallery-gold.png"}
          alt="Bridget Pope Designs portrait"
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </div>
    </MarketingPage>
  );
}

import { MarketingPage } from "@/components/marketing/MarketingPage";
import { getWebsiteSection } from "@/lib/website/content";

export const dynamic = "force-dynamic";

function biographyParagraphs(biography: string) {
  return biography
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function AboutPage() {
  const about = await getWebsiteSection("about");
  const paragraphs = biographyParagraphs(about.biography);

  return (
    <MarketingPage eyebrow={about.eyebrow} title={about.heading}>
      <div className="placeholder-grid">
        <section className="placeholder-hero">
          <h1>{about.heading}</h1>
          {paragraphs.map((paragraph, index) => (
            <p className="mini-meta" key={`about-bio-${index}`} style={{ marginTop: 14 }}>
              {paragraph}
            </p>
          ))}
          {about.signature ? <p className="script" style={{ marginTop: 18 }}>{about.signature}</p> : null}
        </section>
        <img
          className="card"
          src={about.portraitImage || "/images/bridget-pope-portrait.jpg"}
          alt="Portrait of Bridget Pope, founder of Bridget Pope Designs."
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </div>
    </MarketingPage>
  );
}

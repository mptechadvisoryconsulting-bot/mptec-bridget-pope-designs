import { ButtonLink } from "@/components/ui/button";
import { getWebsiteSection } from "@/lib/website/content";

function biographyParagraphs(biography: string) {
  return biography
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function MeetBridget() {
  const about = await getWebsiteSection("about");
  const paragraphs = biographyParagraphs(about.biography);
  const portrait = about.portraitImage || "/images/bridget-pope-portrait.jpg";
  const primaryHref = about.primaryButtonHref || "/inquire";
  const secondaryHref = about.secondaryButtonHref || "/about";

  return (
    <section className="section meet-bridget-band" aria-labelledby="meet-bridget-heading">
      <div className="container meet-bridget-grid">
        <div className="meet-bridget-portrait">
          <img
            src={portrait}
            alt="Portrait of Bridget Pope, founder of Bridget Pope Designs."
          />
        </div>
        <div className="meet-bridget-copy">
          <span className="eyebrow">{about.eyebrow || "Meet the Designer"}</span>
          <h2 id="meet-bridget-heading">{about.heading || "Meet Bridget Pope"}</h2>
          {paragraphs.map((paragraph, index) => (
            <p key={`meet-bio-${index}`}>{paragraph}</p>
          ))}
          {about.signature ? <p className="meet-bridget-closing">{about.signature}</p> : null}
          <div className="meet-bridget-actions">
            <ButtonLink href={primaryHref}>{about.primaryButtonText || "Submit Event Questionnaire"}</ButtonLink>
            <ButtonLink href={secondaryHref} variant="secondary">
              {about.secondaryButtonText || "Learn More"}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { navItems } from "@/lib/data";
import { getWebsiteSection } from "@/lib/website/content";

export function MarketingHeader({ showConsultationCta = true }: { showConsultationCta?: boolean }) {
  return (
    <header className="marketing-header">
      <div className="container marketing-nav">
        <Link className="brand" href="/">
          Bridget Pope
          <span>Designs</span>
        </Link>
        <nav className="nav-links" aria-label="Marketing navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        {showConsultationCta ? <ButtonLink href="/inquire">Book a Consultation</ButtonLink> : <span aria-hidden="true" />}
      </div>
    </header>
  );
}

export async function Hero() {
  const hero = await getWebsiteSection("hero");

  return (
    <>
      <MarketingHeader showConsultationCta={false} />
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">{hero.eyebrow}</span>
            <h1>
              {hero.heading}
              {hero.scriptHeading ? <span className="script">{hero.scriptHeading}</span> : null}
            </h1>
            <p>{hero.subheading}</p>
            <div className="hero-actions">
              <ButtonLink href={hero.primaryButtonHref || "/inquire"}>
                {hero.primaryButtonText || "Book a Consultation"} <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href={hero.secondaryButtonHref || "/services"} variant="secondary">
                {hero.secondaryButtonText || "Explore Services"}
              </ButtonLink>
            </div>
          </div>
          <div
            className="hero-visual"
            style={{ backgroundImage: `url('${hero.backgroundImage || "/images/event-hero.png"}')` }}
          />
        </div>
      </section>
    </>
  );
}

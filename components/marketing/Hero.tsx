import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { navItems } from "@/lib/data";

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

export function Hero() {
  return (
    <>
      <MarketingHeader showConsultationCta={false} />
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Luxury event design and planning</span>
            <h1>
              Designed Beautifully.
              <span className="script">Celebrated Forever.</span>
            </h1>
            <p>
              From unforgettable weddings to milestone celebrations and corporate events, we create stunning experiences
              with elegant details and flawless execution.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/services" variant="secondary">
                Explore Services
              </ButtonLink>
            </div>
          </div>
          <div className="hero-visual" style={{ backgroundImage: "url('/images/event-hero.png')" }} />
        </div>
      </section>
    </>
  );
}

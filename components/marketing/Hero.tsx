import Link from "next/link";
import { ArrowRight, Gem, Heart, MapPin, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { navItems } from "@/lib/data";

export function MarketingHeader() {
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
        <ButtonLink href="/inquire">Book a Consultation</ButtonLink>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <>
      <MarketingHeader />
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
              <ButtonLink href="/inquire">
                Book a Consultation <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="/services" variant="secondary">
                Explore Services
              </ButtonLink>
            </div>
          </div>
          <div className="hero-visual" style={{ backgroundImage: "url('/images/event-hero.png')" }} />
        </div>
      </section>
      <div className="feature-strip">
        <div className="feature-item">
          <Gem size={26} />
          <div>
            <strong>Luxury Details</strong>
            <span>Elevated and elegant</span>
          </div>
        </div>
        <div className="feature-item">
          <Heart size={26} />
          <div>
            <strong>Custom Design</strong>
            <span>Tailored to you</span>
          </div>
        </div>
        <div className="feature-item">
          <Sparkles size={26} />
          <div>
            <strong>Memorable Experiences</strong>
            <span>Made to last</span>
          </div>
        </div>
        <div className="feature-item">
          <MapPin size={26} />
          <div>
            <strong>Murfreesboro, TN</strong>
            <span>And surrounding areas</span>
          </div>
        </div>
      </div>
    </>
  );
}

import { Baby, BriefcaseBusiness, Cake, Flower2, Gem, Gift, Heart, MapPin, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getWebsiteSection, type ServiceItem } from "@/lib/website/content";

const icons = [Flower2, Baby, Cake, BriefcaseBusiness, Sparkles, Gift];

function visibleSorted(items: ServiceItem[]) {
  return items.filter((item) => item.visible !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function Services() {
  const services = await getWebsiteSection("services");
  const items = visibleSorted(services.items).slice(0, 4);

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">{services.eyebrow}</span>
          <h2>{services.heading}</h2>
        </div>
        <div className="service-grid">
          {items.map((service, index) => {
            const Icon = icons[index % icons.length];
            return (
              <article className="card service-card" key={service.key || service.title}>
                <Icon size={34} strokeWidth={1.6} />
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            );
          })}
        </div>
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <ButtonLink href="/services" variant="secondary">
            View All Services
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export async function ServiceCatalog() {
  const services = await getWebsiteSection("services");
  const items = visibleSorted(services.items);

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Service catalog</span>
          <h1>Luxury Event Services</h1>
          <p>Choose a focused install or a full design and planning experience with proposals, contracts, invoices, and timeline coordination in your client portal.</p>
        </div>
        <div className="service-grid">
          {items.map((service, index) => {
            const Icon = icons[index % icons.length];
            return (
              <article className="card service-card" key={service.key || service.title}>
                <Icon size={34} strokeWidth={1.6} />
                <h3>{service.title}</h3>
                <p>{service.detail || service.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PlanningDetails() {
  return (
    <section className="section service-details-band">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Planning details</span>
          <h2>Designed Around the Way Your Event Should Feel</h2>
        </div>
        <div className="feature-strip feature-strip-contained">
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
      </div>
    </section>
  );
}

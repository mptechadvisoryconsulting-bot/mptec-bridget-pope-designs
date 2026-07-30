import { Star } from "lucide-react";
import { getWebsiteSection } from "@/lib/website/content";

type TestimonialsProps = {
  /** Homepage only renders when CMS `showOnHomepage` is enabled. */
  placement?: "page" | "homepage";
};

export async function Testimonials({ placement = "page" }: TestimonialsProps) {
  const content = await getWebsiteSection("testimonials");

  if (!content.enabled) return null;
  if (placement === "homepage" && !content.showOnHomepage) return null;

  const items = (content.items ?? [])
    .filter((item) => item.visible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">{content.eyebrow}</span>
          <h2>{content.heading}</h2>
        </div>
        <div className="testimonial-grid">
          {items.map((testimonial) => (
            <article className="card service-card" key={testimonial.id || testimonial.name} style={{ textAlign: "left" }}>
              <div style={{ color: "var(--gold)", display: "flex", gap: 4, marginBottom: 14 }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star fill="currentColor" key={index} size={15} />
                ))}
              </div>
              <p style={{ fontSize: 15 }}>&ldquo;{testimonial.quote}&rdquo;</p>
              <h3 style={{ marginTop: 18 }}>{testimonial.name}</h3>
              <p>{testimonial.event}</p>
            </article>
          ))}
          {!items.length ? <p className="mini-meta">Client reviews will appear here once published in Website Content.</p> : null}
        </div>
      </div>
    </section>
  );
}

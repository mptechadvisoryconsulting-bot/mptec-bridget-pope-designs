import { Star } from "lucide-react";
import { testimonials } from "@/lib/data";

export function Testimonials() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Client reviews</span>
          <h2>Trusted for Milestone Moments</h2>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <article className="card service-card" key={testimonial.name} style={{ textAlign: "left" }}>
              <div style={{ color: "var(--gold)", display: "flex", gap: 4, marginBottom: 14 }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star fill="currentColor" key={index} size={15} />
                ))}
              </div>
              <p style={{ fontSize: 15 }}>"{testimonial.quote}"</p>
              <h3 style={{ marginTop: 18 }}>{testimonial.name}</h3>
              <p>{testimonial.event}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

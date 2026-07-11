import { faqs } from "@/lib/data";

export function FAQ() {
  return (
    <section className="section gallery-band">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Questions</span>
          <h2>Planning Details</h2>
        </div>
        <div className="placeholder-grid">
          {faqs.map((faq) => (
            <article className="card service-card" key={faq.question} style={{ textAlign: "left" }}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

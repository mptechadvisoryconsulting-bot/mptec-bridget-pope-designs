import { getWebsiteSection } from "@/lib/website/content";

export async function FAQ() {
  const faq = await getWebsiteSection("faq");
  const items = (faq.items ?? [])
    .filter((item) => item.visible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (!items.length) return null;

  return (
    <section className="section gallery-band">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">{faq.eyebrow}</span>
          <h2>{faq.heading}</h2>
        </div>
        <div className="placeholder-grid">
          {items.map((item) => (
            <article className="card service-card" key={item.id || item.question} style={{ textAlign: "left" }}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

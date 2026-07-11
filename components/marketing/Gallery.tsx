import { galleryItems } from "@/lib/data";

export function Gallery() {
  return (
    <section className="section gallery-band">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">A glimpse of our work</span>
          <h2>Beautiful Moments, Perfectly Designed</h2>
        </div>
        <div className="gallery-tabs" aria-label="Gallery filters">
          {["All Events", "Weddings", "Showers", "Birthdays", "Corporate"].map((tab) => (
            <span className="pill" key={tab}>
              {tab}
            </span>
          ))}
        </div>
        <div className="gallery-grid">
          {galleryItems.map((item) => (
            <figure className="gallery-card" key={item.title}>
              <img src={item.image} alt={`${item.title} event design`} />
              <figcaption>
                <small>{item.category}</small>
                <strong>{item.title}</strong>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

import { getPublicGalleryItems } from "@/lib/gallery";

export async function Gallery() {
  const galleryItems = await getPublicGalleryItems(8);
  const tabs = galleryItems.length ? ["All Events", ...Array.from(new Set(galleryItems.map((item) => item.category))).slice(0, 4)] : [];

  return (
    <section className="section gallery-band">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">A glimpse of our work</span>
          <h2>Beautiful Moments, Perfectly Designed</h2>
        </div>
        {tabs.length ? (
          <div className="gallery-tabs" aria-label="Gallery filters">
            {tabs.map((tab) => (
              <span className="pill" key={tab}>
                {tab}
              </span>
            ))}
          </div>
        ) : null}
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
          {!galleryItems.length ? <p className="mini-meta">Gallery photos will appear here after they are uploaded in the admin gallery manager.</p> : null}
        </div>
      </div>
    </section>
  );
}

import { getPublicGalleryItems } from "@/lib/gallery";
import { getWebsiteSection } from "@/lib/website/content";

export async function Gallery({
  mode = "library",
  limit = 24,
}: {
  mode?: "library" | "homepage" | "featured";
  limit?: number;
}) {
  const [galleryItems, copy] = await Promise.all([
    getPublicGalleryItems({
      limit,
      homepageOnly: mode === "homepage",
      featuredOnly: mode === "featured",
    }),
    mode === "homepage" || mode === "featured"
      ? getWebsiteSection(mode === "featured" ? "featured_designs" : "homepage_gallery")
      : Promise.resolve({ eyebrow: "Gallery", heading: "Event Design Gallery" }),
  ]);

  const tabs = galleryItems.length
    ? ["All Events", ...Array.from(new Set(galleryItems.map((item) => item.category))).slice(0, 4)]
    : [];

  return (
    <section className="section gallery-band">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2>{copy.heading}</h2>
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
            <figure className="gallery-card" key={item.id}>
              <img src={item.image} alt={`${item.title} event design`} />
              <figcaption>
                <small>{item.category}</small>
                <strong>{item.title}</strong>
              </figcaption>
            </figure>
          ))}
          {!galleryItems.length ? (
            <p className="mini-meta">
              {mode === "homepage"
                ? "Homepage gallery photos will appear here once they are marked Display on Homepage in the admin gallery manager."
                : "Gallery photos will appear here after they are uploaded in the admin gallery manager."}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

import { Instagram, Mail, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getPublicContactEmail } from "@/lib/business/public-contact";

export async function Footer({ showCta = true }: { showCta?: boolean }) {
  const contactEmail = await getPublicContactEmail();

  return (
    <>
      {showCta ? (
        <section className="cta-band">
          <div className="container cta-inner">
            <div>
              <h2>Let's Design Your Next Unforgettable Event</h2>
              <p>Consultations are by appointment. We would love to bring your vision to life.</p>
            </div>
            <ButtonLink href="/inquire">
              Book Your Consultation
            </ButtonLink>
          </div>
        </section>
      ) : null}
      <footer className="footer">
        <div className="container footer-grid">
          <div className="brand">
            Bridget Pope
            <span>Designs</span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <span style={{ display: "inline-flex", gap: 8 }}><Phone size={16} /> (629) 295-4210</span>
            <a href={`mailto:${contactEmail}`} style={{ display: "inline-flex", gap: 8, color: "inherit" }}>
              <Mail size={16} /> {contactEmail}
            </a>
          </div>
          <div className="footer-links">
            <Instagram size={18} />
            <Mail size={18} />
            <Phone size={18} />
          </div>
        </div>
      </footer>
    </>
  );
}

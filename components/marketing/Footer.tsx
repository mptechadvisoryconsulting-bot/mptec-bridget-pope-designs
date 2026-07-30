import { Instagram, Mail, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getPublicContactEmail } from "@/lib/business/public-contact";
import { getWebsiteSection } from "@/lib/website/content";

export async function Footer({ showCta = true }: { showCta?: boolean }) {
  const [contactEmail, footer, contact, social] = await Promise.all([
    getPublicContactEmail(),
    getWebsiteSection("footer"),
    getWebsiteSection("contact"),
    getWebsiteSection("social"),
  ]);

  const phone = contact.phone || "(629) 295-4210";
  const email = contact.email || contactEmail;
  const year = new Date().getFullYear();

  return (
    <>
      {showCta ? (
        <section className="cta-band">
          <div className="container cta-inner">
            <div>
              <h2>{footer.ctaHeading}</h2>
              <p>{footer.ctaBody}</p>
            </div>
            <ButtonLink href={footer.ctaButtonHref || "/inquire"}>{footer.ctaButtonText || "Submit a questionnaire"}</ButtonLink>
          </div>
        </section>
      ) : null}
      <footer className="footer">
        <div className="container footer-grid">
          <div className="brand">
            Bridget Pope
            <span>Designs</span>
            <div className="mini-meta" style={{ marginTop: 8 }}>
              © {year} {footer.copyright}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", gap: 8 }}>
              <Phone size={16} /> {phone}
            </span>
            <a href={`mailto:${email}`} style={{ display: "inline-flex", gap: 8, color: "inherit" }}>
              <Mail size={16} /> {email}
            </a>
            {footer.quickLinks?.length ? (
              <div className="footer-links" style={{ gap: 12 }}>
                {footer.quickLinks.map((link) => (
                  <a key={`${link.href}-${link.label}`} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="footer-links">
            {social.instagram || contact.instagram ? <Instagram size={18} /> : null}
            <Mail size={18} />
            <Phone size={18} />
          </div>
        </div>
      </footer>
    </>
  );
}

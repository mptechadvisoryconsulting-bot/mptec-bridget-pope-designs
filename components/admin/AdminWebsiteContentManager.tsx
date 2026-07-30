"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import type { WebsiteContentMap, WebsiteSectionKey } from "@/lib/website/content";

const sections: Array<{ key: WebsiteSectionKey; label: string; help: string }> = [
  { key: "hero", label: "Hero", help: "Homepage hero heading, buttons, and background image." },
  { key: "services", label: "Services", help: "Six fixed services — edit copy, order, and visibility." },
  { key: "homepage_gallery", label: "Homepage Gallery", help: "Section headings. Manage images in Gallery Manager." },
  { key: "featured_designs", label: "Featured Designs", help: "Featured section copy. Toggle images in Gallery Manager." },
  { key: "about", label: "About Bridget", help: "Portrait, biography, and optional signature." },
  { key: "contact", label: "Contact Information", help: "Business contact details shown in the footer and contact surfaces." },
  { key: "testimonials", label: "Testimonials", help: "Add, edit, reorder, or hide reviews." },
  { key: "footer", label: "Footer", help: "CTA band, copyright, and quick links." },
  { key: "social", label: "Social Links", help: "Instagram and other social URLs." },
];

export function AdminWebsiteContentManager({ initialContent }: { initialContent: WebsiteContentMap }) {
  const [content, setContent] = useState(initialContent);
  const [active, setActive] = useState<WebsiteSectionKey>("hero");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const activeMeta = useMemo(() => sections.find((section) => section.key === active)!, [active]);

  async function saveSection(sectionKey: WebsiteSectionKey, next: Record<string, unknown>) {
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/admin/website-content", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sectionKey, content: next }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setStatus(payload.message ?? "Unable to save.");
      return;
    }
    setContent((current) => ({ ...current, [sectionKey]: { ...current[sectionKey], ...next } }));
    setStatus("Saved. Changes publish immediately on the public site.");
  }

  function updateActive(patch: Record<string, unknown>) {
    setContent((current) => ({
      ...current,
      [active]: { ...current[active], ...patch },
    }));
  }

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Website</span>
          <h1>Website Content</h1>
          <p className="mini-meta">Edit marketing copy and media. Saves publish immediately (preview is a follow-up).</p>
        </div>
        <Link className="btn btn-light" href="/admin/gallery">
          Open Gallery Manager
        </Link>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Sections</h2>
          <ul className="list">
            {sections.map((section) => (
              <li key={section.key}>
                <button
                  className={active === section.key ? "btn" : "btn btn-light"}
                  onClick={() => setActive(section.key)}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  type="button"
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel span-2">
          <h2>{activeMeta.label}</h2>
          <p className="mini-meta">{activeMeta.help}</p>
          {status ? <p className={/unable|fail|error/i.test(status) ? "form-error" : "form-success"}>{status}</p> : null}

          {active === "hero" ? (
            <div className="form-grid">
              <Field label="Eyebrow"><Input value={content.hero.eyebrow} onChange={(e) => updateActive({ eyebrow: e.target.value })} /></Field>
              <Field label="Heading"><Input value={content.hero.heading} onChange={(e) => updateActive({ heading: e.target.value })} /></Field>
              <Field label="Script heading"><Input value={content.hero.scriptHeading} onChange={(e) => updateActive({ scriptHeading: e.target.value })} /></Field>
              <Field label="Subheading" wide><Textarea value={content.hero.subheading} onChange={(e) => updateActive({ subheading: e.target.value })} /></Field>
              <Field label="Primary button text"><Input value={content.hero.primaryButtonText} onChange={(e) => updateActive({ primaryButtonText: e.target.value })} /></Field>
              <Field label="Primary button link"><Input value={content.hero.primaryButtonHref} onChange={(e) => updateActive({ primaryButtonHref: e.target.value })} /></Field>
              <Field label="Secondary button text"><Input value={content.hero.secondaryButtonText} onChange={(e) => updateActive({ secondaryButtonText: e.target.value })} /></Field>
              <Field label="Secondary button link"><Input value={content.hero.secondaryButtonHref} onChange={(e) => updateActive({ secondaryButtonHref: e.target.value })} /></Field>
              <Field label="Background image URL" wide><Input value={content.hero.backgroundImage} onChange={(e) => updateActive({ backgroundImage: e.target.value })} /></Field>
            </div>
          ) : null}

          {active === "services" ? (
            <div className="form-grid">
              <Field label="Eyebrow"><Input value={content.services.eyebrow} onChange={(e) => updateActive({ eyebrow: e.target.value })} /></Field>
              <Field label="Heading" wide><Input value={content.services.heading} onChange={(e) => updateActive({ heading: e.target.value })} /></Field>
              {content.services.items.map((item, index) => (
                <div className="panel wide" key={item.key} style={{ padding: 16 }}>
                  <strong>{item.title}</strong>
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <Field label="Short description" wide>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          const items = content.services.items.map((row, i) => (i === index ? { ...row, description: e.target.value } : row));
                          updateActive({ items });
                        }}
                      />
                    </Field>
                    <Field label="Detail" wide>
                      <Textarea
                        value={item.detail}
                        onChange={(e) => {
                          const items = content.services.items.map((row, i) => (i === index ? { ...row, detail: e.target.value } : row));
                          updateActive({ items });
                        }}
                      />
                    </Field>
                    <Field label="Image URL">
                      <Input
                        value={item.image ?? ""}
                        onChange={(e) => {
                          const items = content.services.items.map((row, i) => (i === index ? { ...row, image: e.target.value || null } : row));
                          updateActive({ items });
                        }}
                      />
                    </Field>
                    <Field label="Order">
                      <Input
                        type="number"
                        value={item.sortOrder}
                        onChange={(e) => {
                          const items = content.services.items.map((row, i) =>
                            i === index ? { ...row, sortOrder: Number(e.target.value) || 0 } : row,
                          );
                          updateActive({ items });
                        }}
                      />
                    </Field>
                    <label className="check-row">
                      <input
                        checked={item.visible !== false}
                        type="checkbox"
                        onChange={(e) => {
                          const items = content.services.items.map((row, i) => (i === index ? { ...row, visible: e.target.checked } : row));
                          updateActive({ items });
                        }}
                      />
                      <span>Show on website</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {active === "homepage_gallery" || active === "featured_designs" ? (
            <div className="form-grid">
              <Field label="Eyebrow">
                <Input
                  value={(content[active] as { eyebrow: string }).eyebrow}
                  onChange={(e) => updateActive({ eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Heading" wide>
                <Input
                  value={(content[active] as { heading: string }).heading}
                  onChange={(e) => updateActive({ heading: e.target.value })}
                />
              </Field>
              <p className="mini-meta wide">
                Choose which photos appear via{" "}
                <Link href="/admin/gallery">Gallery Manager</Link> (Homepage Visible / Featured toggles).
              </p>
            </div>
          ) : null}

          {active === "about" ? (
            <div className="form-grid">
              <Field label="Eyebrow"><Input value={content.about.eyebrow} onChange={(e) => updateActive({ eyebrow: e.target.value })} /></Field>
              <Field label="Heading"><Input value={content.about.heading} onChange={(e) => updateActive({ heading: e.target.value })} /></Field>
              <Field label="Biography" wide><Textarea value={content.about.biography} onChange={(e) => updateActive({ biography: e.target.value })} /></Field>
              <Field label="Portrait image URL" wide><Input value={content.about.portraitImage} onChange={(e) => updateActive({ portraitImage: e.target.value })} /></Field>
              <Field label="Signature (optional)" wide><Input value={content.about.signature ?? ""} onChange={(e) => updateActive({ signature: e.target.value || null })} /></Field>
            </div>
          ) : null}

          {active === "contact" ? (
            <div className="form-grid">
              <Field label="Business name"><Input value={content.contact.businessName} onChange={(e) => updateActive({ businessName: e.target.value })} /></Field>
              <Field label="Phone"><Input value={content.contact.phone} onChange={(e) => updateActive({ phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={content.contact.email ?? ""} onChange={(e) => updateActive({ email: e.target.value || null })} /></Field>
              <Field label="Website"><Input value={content.contact.website ?? ""} onChange={(e) => updateActive({ website: e.target.value || null })} /></Field>
              <Field label="Address" wide><Input value={content.contact.address ?? ""} onChange={(e) => updateActive({ address: e.target.value || null })} /></Field>
              <Field label="Hours" wide><Input value={content.contact.hours ?? ""} onChange={(e) => updateActive({ hours: e.target.value || null })} /></Field>
            </div>
          ) : null}

          {active === "testimonials" ? (
            <div className="form-grid">
              <Field label="Eyebrow"><Input value={content.testimonials.eyebrow} onChange={(e) => updateActive({ eyebrow: e.target.value })} /></Field>
              <Field label="Heading" wide><Input value={content.testimonials.heading} onChange={(e) => updateActive({ heading: e.target.value })} /></Field>
              {content.testimonials.items.map((item, index) => (
                <div className="panel wide" key={item.id} style={{ padding: 16 }}>
                  <div className="form-grid">
                    <Field label="Name"><Input value={item.name} onChange={(e) => {
                      const items = content.testimonials.items.map((row, i) => (i === index ? { ...row, name: e.target.value } : row));
                      updateActive({ items });
                    }} /></Field>
                    <Field label="Event"><Input value={item.event} onChange={(e) => {
                      const items = content.testimonials.items.map((row, i) => (i === index ? { ...row, event: e.target.value } : row));
                      updateActive({ items });
                    }} /></Field>
                    <Field label="Quote" wide><Textarea value={item.quote} onChange={(e) => {
                      const items = content.testimonials.items.map((row, i) => (i === index ? { ...row, quote: e.target.value } : row));
                      updateActive({ items });
                    }} /></Field>
                    <Field label="Order"><Input type="number" value={item.sortOrder} onChange={(e) => {
                      const items = content.testimonials.items.map((row, i) => (i === index ? { ...row, sortOrder: Number(e.target.value) || 0 } : row));
                      updateActive({ items });
                    }} /></Field>
                    <label className="check-row">
                      <input checked={item.visible !== false} type="checkbox" onChange={(e) => {
                        const items = content.testimonials.items.map((row, i) => (i === index ? { ...row, visible: e.target.checked } : row));
                        updateActive({ items });
                      }} />
                      <span>Visible</span>
                    </label>
                    <Button
                      type="button"
                      variant="light"
                      onClick={() => updateActive({ items: content.testimonials.items.filter((_, i) => i !== index) })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="light"
                onClick={() =>
                  updateActive({
                    items: [
                      ...content.testimonials.items,
                      {
                        id: `t-${Date.now()}`,
                        name: "Client",
                        event: "Event",
                        quote: "Share a short review.",
                        visible: true,
                        sortOrder: content.testimonials.items.length,
                      },
                    ],
                  })
                }
              >
                Add testimonial
              </Button>
            </div>
          ) : null}

          {active === "footer" ? (
            <div className="form-grid">
              <Field label="CTA heading" wide><Input value={content.footer.ctaHeading} onChange={(e) => updateActive({ ctaHeading: e.target.value })} /></Field>
              <Field label="CTA body" wide><Textarea value={content.footer.ctaBody} onChange={(e) => updateActive({ ctaBody: e.target.value })} /></Field>
              <Field label="CTA button text"><Input value={content.footer.ctaButtonText} onChange={(e) => updateActive({ ctaButtonText: e.target.value })} /></Field>
              <Field label="CTA button link"><Input value={content.footer.ctaButtonHref} onChange={(e) => updateActive({ ctaButtonHref: e.target.value })} /></Field>
              <Field label="Copyright" wide><Input value={content.footer.copyright} onChange={(e) => updateActive({ copyright: e.target.value })} /></Field>
            </div>
          ) : null}

          {active === "social" ? (
            <div className="form-grid">
              <Field label="Instagram URL"><Input value={content.social.instagram ?? ""} onChange={(e) => updateActive({ instagram: e.target.value || null })} /></Field>
              <Field label="Facebook URL"><Input value={content.social.facebook ?? ""} onChange={(e) => updateActive({ facebook: e.target.value || null })} /></Field>
              <Field label="Pinterest URL"><Input value={content.social.pinterest ?? ""} onChange={(e) => updateActive({ pinterest: e.target.value || null })} /></Field>
              <Field label="Public email"><Input value={content.social.email ?? ""} onChange={(e) => updateActive({ email: e.target.value || null })} /></Field>
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <Button
              disabled={saving}
              onClick={() => saveSection(active, content[active] as unknown as Record<string, unknown>)}
              type="button"
            >
              {saving ? "Saving..." : "Save section"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

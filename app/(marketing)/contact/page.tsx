import { Mail, MapPin, Phone } from "lucide-react";
import { InquiryForm } from "@/components/marketing/InquiryForm";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { getPublicContactEmail } from "@/lib/business/public-contact";
import { getInquiryContent } from "@/lib/website/inquiry-content";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const [contactEmail, inquiryConfig] = await Promise.all([getPublicContactEmail(), getInquiryContent()]);

  return (
    <MarketingPage eyebrow="Contact" title="Let's Talk Through the Details">
      <div className="placeholder-grid">
        <section className="panel">
          <h2>Studio</h2>
          <ul className="list">
            <li><span><Phone size={16} /> (629) 295-4210</span></li>
            <li>
              <a href={`mailto:${contactEmail}`} style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "inherit" }}>
                <Mail size={16} /> {contactEmail}
              </a>
            </li>
            <li><span><MapPin size={16} /> Murfreesboro, TN</span></li>
          </ul>
        </section>
        <InquiryForm config={inquiryConfig} />
      </div>
    </MarketingPage>
  );
}

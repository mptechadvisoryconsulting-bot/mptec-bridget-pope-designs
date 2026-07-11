import { Mail, MapPin, Phone } from "lucide-react";
import { InquiryForm } from "@/components/marketing/InquiryForm";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export default function ContactPage() {
  return (
    <MarketingPage eyebrow="Contact" title="Let's Talk Through the Details">
      <div className="placeholder-grid">
        <section className="panel">
          <h2>Studio</h2>
          <ul className="list">
            <li><span><Phone size={16} /> (629) 295-4210</span></li>
            <li><span><Mail size={16} /> hello@bridgetpopedesigns.com</span></li>
            <li><span><MapPin size={16} /> Murfreesboro, TN</span></li>
          </ul>
        </section>
        <InquiryForm />
      </div>
    </MarketingPage>
  );
}

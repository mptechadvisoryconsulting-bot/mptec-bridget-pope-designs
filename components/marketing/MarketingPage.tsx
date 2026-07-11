import { MarketingHeader } from "@/components/marketing/Hero";
import { Footer } from "@/components/marketing/Footer";

export function MarketingPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell">
      <MarketingHeader />
      <main>
        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
            </div>
            {children}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

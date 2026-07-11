import { Download, FileSignature, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { checklistItems, proposalItems, timelineItems } from "@/lib/data";
import { currency } from "@/lib/currency";

export function ClientSectionPage({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow: string;
}) {
  const proposalTotal = proposalItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="mini-meta">Everything here is scoped for the current Elegant Garden Wedding project.</p>
        </div>
      </div>
      <div className="placeholder-grid">
        <section className="panel">
          <h2>Current Proposal</h2>
          {proposalItems.map((item) => (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }} key={item.name}>
              <span>{item.name}</span>
              <strong>{currency(item.price)}</strong>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #eee2e5", display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
            <strong>Total</strong>
            <strong>{currency(proposalTotal)}</strong>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <ButtonLink href="/client/proposals/proposal-1001">
              <FileSignature size={16} /> Review
            </ButtonLink>
            <ButtonLink href="/client/documents" variant="light">
              <Download size={16} /> Download
            </ButtonLink>
          </div>
        </section>
        <section className="panel">
          <h2>Upcoming Milestones</h2>
          <ul className="list">
            {timelineItems.map((item) => (
              <li key={item.title}>
                <span>{item.title}</span>
                <span className="mini-meta">{item.date}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Checklist</h2>
          <ul className="list">
            {checklistItems.slice(0, 5).map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <span className="status">{item.done ? "Done" : "Open"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="placeholder-hero">
          <Upload color="var(--blush)" size={34} />
          <h1>Uploads and Design Files</h1>
          <p className="mini-meta">Mood boards, venue notes, signed PDFs, receipts, inspiration uploads, and planner attachments appear here.</p>
        </section>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { ProposalBuilder } from "@/components/admin/ProposalBuilder";

export default function NewProposalPage() {
  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Proposal Builder</span>
          <h1>New Proposal</h1>
        </div>
      </div>
      <div className="placeholder-grid">
        <Suspense fallback={<section className="panel"><p className="mini-meta">Loading proposal builder...</p></section>}>
          <ProposalBuilder />
        </Suspense>
        <section className="panel">
          <h2>Proposal Sections</h2>
          <ul className="list">
            {["Client information", "Event information", "Color palette", "Service list", "Rental list", "Labor", "Delivery", "Tax", "Deposit", "Signature"].map((item) => (
              <li key={item}>{item}<span className="status">Ready</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

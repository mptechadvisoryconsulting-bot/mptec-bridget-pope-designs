import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Settings</span>
          <h1>Billing & Payments</h1>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel span-2">
          <div className="section-heading">
            <div>
              <span className="eyebrow">HoneyBook Billing</span>
              <h2>How financial documents work</h2>
            </div>
          </div>
          <p>
            Bridget Pope Designs uses HoneyBook for proposals, contracts, invoices, payment plans,
            payment collection, and receipts. This application stores project context and a
            client-visible HoneyBook reference only.
          </p>
          <ul className="list" style={{ marginTop: 16 }}>
            <li>
              <span>Create/send in HoneyBook</span>
              <span className="status">Source of truth</span>
            </li>
            <li>
              <span>Link reference</span>
              <span className="status">Project workspace</span>
            </li>
            <li>
              <span>Client view</span>
              <span className="status">View in HoneyBook</span>
            </li>
          </ul>
          <div className="topbar-actions" style={{ marginTop: 16 }}>
            <ButtonLink href="/admin/honeybook" variant="light">
              Review HoneyBook References
            </ButtonLink>
            <ButtonLink href="/admin/projects" variant="secondary">
              Open Projects
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}

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
              <span className="eyebrow">Offline Billing</span>
              <h2>How payments work</h2>
            </div>
          </div>
          <p>
            Online card checkout is not enabled in this application. Send invoices from the admin
            CRM, then record payments manually when funds are received (check, bank transfer, cash,
            or other offline methods).
          </p>
          <ul className="list" style={{ marginTop: 16 }}>
            <li>
              <span>Send invoice</span>
              <span className="status">Client receives email + PDF</span>
            </li>
            <li>
              <span>Collect offline</span>
              <span className="status">Outside this app</span>
            </li>
            <li>
              <span>Record payment</span>
              <span className="status">On the invoice detail page</span>
            </li>
          </ul>
          <div className="topbar-actions" style={{ marginTop: 16 }}>
            <ButtonLink href="/admin/invoices" variant="light">
              Open invoices
            </ButtonLink>
            <ButtonLink href="/admin/payments" variant="secondary">
              Payment records
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}

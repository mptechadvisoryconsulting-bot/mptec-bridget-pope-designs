import { ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import { latestHoneyBookReference, loadProjectHoneyBookReferences } from "@/lib/honeybook/references";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientHoneyBookPage() {
  const { project } = await requireClientPortalContext("/client/honeybook");
  const references = project?.id ? await loadProjectHoneyBookReferences(createAdminClient(), project.id) : [];
  const latest = latestHoneyBookReference(references);

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">HoneyBook</span>
          <h1>Financial Reference</h1>
          <p className="mini-meta">
            Some payment arrangements may be coordinated through HoneyBook. Your in-app invoices and payments remain available in this portal.
          </p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/client/invoices" variant="light">View Invoices</ButtonLink>
          <ButtonLink href="/client/payments" variant="secondary">Payments</ButtonLink>
        </div>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Reference Only</span>
            <h2>HoneyBook Status</h2>
          </div>
          <span className="status">{latest?.invoice_status ?? "Not linked"}</span>
        </div>

        {latest ? (
          <>
            <dl className="resource-details">
              <div><dt>Invoice Reference</dt><dd>{latest.honeybook_invoice_number ?? "Not provided"}</dd></div>
              <div><dt>Total</dt><dd>{latest.invoice_total != null ? currency(Number(latest.invoice_total)) : "Not provided"}</dd></div>
              <div><dt>Amount Paid</dt><dd>{latest.amount_paid != null ? currency(Number(latest.amount_paid)) : "Not provided"}</dd></div>
              <div><dt>Balance Reference</dt><dd>{latest.balance_remaining != null ? currency(Number(latest.balance_remaining)) : "Not provided"}</dd></div>
              <div><dt>Invoice Date</dt><dd>{formatDate(latest.invoice_date, "Not provided")}</dd></div>
              <div><dt>Due Date</dt><dd>{formatDate(latest.due_date, "Not provided")}</dd></div>
            </dl>
            {latest.honeybook_url ? (
              <a className="btn btn-primary" href={latest.honeybook_url} rel="noreferrer" target="_blank">
                <ExternalLink size={16} /> View in HoneyBook
              </a>
            ) : (
              <p className="mini-meta">Bridget has not linked a HoneyBook URL yet.</p>
            )}
          </>
        ) : (
          <p className="mini-meta">No HoneyBook financial reference has been shared for this project yet.</p>
        )}
      </section>
    </div>
  );
}

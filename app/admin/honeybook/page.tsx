import { ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export const dynamic = "force-dynamic";

type ReferenceRow = {
  id: string;
  project_id: string;
  honeybook_project_id?: string | null;
  honeybook_invoice_number?: string | null;
  invoice_total?: number | null;
  amount_paid?: number | null;
  balance_remaining?: number | null;
  invoice_status?: string | null;
  due_date?: string | null;
  honeybook_url?: string | null;
  review_status?: string | null;
  updated_at?: string | null;
  bpd_projects?:
    | {
        event_name?: string | null;
        bpd_clients?:
          | {
              bpd_profiles?:
                | { first_name?: string | null; last_name?: string | null }
                | Array<{ first_name?: string | null; last_name?: string | null }>
                | null;
            }
          | Array<{
              bpd_profiles?:
                | { first_name?: string | null; last_name?: string | null }
                | Array<{ first_name?: string | null; last_name?: string | null }>
                | null;
            }>
          | null;
      }
    | Array<{
        event_name?: string | null;
        bpd_clients?:
          | {
              bpd_profiles?:
                | { first_name?: string | null; last_name?: string | null }
                | Array<{ first_name?: string | null; last_name?: string | null }>
                | null;
            }
          | Array<{
              bpd_profiles?:
                | { first_name?: string | null; last_name?: string | null }
                | Array<{ first_name?: string | null; last_name?: string | null }>
                | null;
            }>
          | null;
      }>
    | null;
};

function clientName(row: ReferenceRow) {
  const project = first(row.bpd_projects);
  const client = first(project?.bpd_clients);
  const profile = first(client?.bpd_profiles);
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";
}

export default async function AdminHoneyBookPage() {
  const supabase = createAdminClient();
  const { data: references } = await supabase
    .from("honeybook_financial_references")
    .select("*,bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name)))")
    .order("updated_at", { ascending: false })
    .limit(80);

  const rows = (references ?? []) as ReferenceRow[];
  const needsReview = rows.filter((row) => row.review_status === "needs_review");

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Sales & Billing</span>
          <h1>Reference Review</h1>
          <p className="mini-meta">
            Optional HoneyBook links for the manual CRM workflow. In-app proposals, invoices, and payments remain available.
          </p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/proposals" variant="light">Proposals</ButtonLink>
          <ButtonLink href="/admin/invoices" variant="light">Invoices</ButtonLink>
        </div>
      </div>

      <section className="stats-grid" aria-label="HoneyBook reference statistics">
        <article className="stat-card"><span>References</span><strong>{rows.length}</strong><small>Linked project records</small></article>
        <article className="stat-card"><span>Needs Review</span><strong>{needsReview.length}</strong><small>Unmatched or imported records</small></article>
        <article className="stat-card"><span>Open Balances</span><strong>{currency(rows.reduce((sum, row) => sum + Number(row.balance_remaining ?? 0), 0))}</strong><small>Reference value only</small></article>
      </section>

      <section className="panel span-2" style={{ marginTop: 16 }}>
        <h2>HoneyBook References</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Invoice</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Due</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const project = first(row.bpd_projects);
              return (
                <tr key={row.id}>
                  <td><a href={`/admin/projects/${row.project_id}`}>{project?.event_name ?? "Project"}</a></td>
                  <td>{clientName(row)}</td>
                  <td>{row.honeybook_invoice_number ?? row.honeybook_project_id ?? "Reference"}</td>
                  <td><span className="status">{row.invoice_status ?? row.review_status ?? "unknown"}</span></td>
                  <td>{row.balance_remaining != null ? currency(Number(row.balance_remaining)) : "—"}</td>
                  <td>{formatDate(row.due_date, "—")}</td>
                  <td>{formatDateTime(row.updated_at, "—")}</td>
                  <td>
                    {row.honeybook_url ? (
                      <a className="btn btn-light" href={row.honeybook_url} rel="noreferrer" target="_blank">
                        <ExternalLink size={15} /> Open
                      </a>
                    ) : (
                      <ButtonLink href={`/admin/projects/${row.project_id}`} variant="light">Project</ButtonLink>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? <tr><td colSpan={8}>No HoneyBook references have been linked yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

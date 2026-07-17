import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id,billing_address,notes,created_at,profile_id,bpd_profiles(first_name,last_name,email,username,phone,active)")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: projects }, { data: invoices }] = await Promise.all([
    supabase.from("projects").select("id,event_name,event_type,event_date,venue_name,status").eq("client_id", clientId).order("event_date", { ascending: true }),
    supabase.from("invoices").select("id,invoice_number,status,total,balance_due,due_date").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);

  const profile = first(client.bpd_profiles);
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";
  const projectRows = projects ?? [];
  const invoiceRows = invoices ?? [];
  const outstanding = invoiceRows.reduce((sum, row) => sum + Number(row.balance_due ?? 0), 0);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">CRM</span>
          <h1>{clientName}</h1>
          <p className="mini-meta">{profile?.email} · {profile?.phone || "Phone not set"} · {profile?.active ? "Active portal" : "Portal not active"}</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href={`/admin/proposals/new`} variant="secondary">Create Proposal</ButtonLink>
          <ButtonLink href="/admin/projects" variant="light">Open Projects</ButtonLink>
          <ButtonLink href="/admin/clients" variant="light">Back to Clients</ButtonLink>
        </div>
      </div>

      <section className="stats-grid" aria-label="Client statistics">
        <article className="stat-card"><span>Projects</span><strong>{projectRows.length}</strong></article>
        <article className="stat-card"><span>Invoices</span><strong>{invoiceRows.length}</strong></article>
        <article className="stat-card"><span>Outstanding</span><strong>{currency(outstanding)}</strong></article>
        <article className="stat-card"><span>Client Since</span><strong>{formatDate(client.created_at?.slice(0, 10), "Not set")}</strong></article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel span-2">
          <h2>Projects</h2>
          <table className="table">
            <thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Venue</th><th>Status</th></tr></thead>
            <tbody>
              {projectRows.map((project) => (
                <tr key={project.id}>
                  <td><a href={`/admin/projects/${project.id}`}>{project.event_name}</a></td>
                  <td>{project.event_type}</td>
                  <td>{formatDate(project.event_date, "Date pending")}</td>
                  <td>{project.venue_name || "Not set"}</td>
                  <td><span className="status">{project.status.replace(/_/g, " ")}</span></td>
                </tr>
              ))}
              {!projectRows.length ? <tr><td colSpan={5}>No projects yet for this client.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Client Profile</h2>
          <ul className="list">
            <li><span>Username</span><span>{profile?.username || "Not set"}</span></li>
            <li><span>Address</span><span>{client.billing_address || "Not set"}</span></li>
          </ul>
          {client.notes ? <p className="mini-meta">{client.notes}</p> : null}
        </section>

        <section className="panel span-2">
          <h2>Invoices</h2>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Balance</th><th>Due</th></tr></thead>
            <tbody>
              {invoiceRows.map((invoice) => (
                <tr key={invoice.id}>
                  <td><a href={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</a></td>
                  <td><span className="status">{invoice.status}</span></td>
                  <td>{currency(Number(invoice.total ?? 0))}</td>
                  <td>{currency(Number(invoice.balance_due ?? 0))}</td>
                  <td>{formatDate(invoice.due_date, "—")}</td>
                </tr>
              ))}
              {!invoiceRows.length ? <tr><td colSpan={5}>No invoices yet for this client.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

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

  const [{ data: projects }, { data: honeybookReferences }] = await Promise.all([
    supabase.from("projects").select("id,event_name,event_type,event_date,venue_name,status").eq("client_id", clientId).order("event_date", { ascending: true }),
    supabase.from("honeybook_financial_references").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }),
  ]);

  const profile = first(client.bpd_profiles);
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";
  const projectRows = projects ?? [];
  const referenceRows = honeybookReferences ?? [];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">CRM</span>
          <h1>{clientName}</h1>
          <p className="mini-meta">{profile?.email} · {profile?.phone || "Phone not set"} · {profile?.active ? "Active portal" : "Portal not active"}</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/projects" variant="secondary">Open Projects</ButtonLink>
          <ButtonLink href="/admin/clients" variant="light">Back to Clients</ButtonLink>
        </div>
      </div>

      <section className="stats-grid" aria-label="Client statistics">
        <article className="stat-card"><span>Projects</span><strong>{projectRows.length}</strong></article>
        <article className="stat-card"><span>HoneyBook References</span><strong>{referenceRows.length}</strong></article>
        <article className="stat-card"><span>Reference Balance</span><strong>{currency(referenceRows.reduce((sum, row) => sum + Number(row.balance_remaining ?? 0), 0))}</strong></article>
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
          <h2>HoneyBook References</h2>
          <table className="table">
            <thead><tr><th>Reference</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
            <tbody>
              {referenceRows.map((reference) => (
                <tr key={reference.id}>
                  <td>{reference.honeybook_invoice_number ?? reference.honeybook_project_id ?? "HoneyBook"}</td>
                  <td><span className="status">{reference.invoice_status ?? "unknown"}</span></td>
                  <td>{reference.invoice_total != null ? currency(Number(reference.invoice_total)) : "—"}</td>
                  <td>{reference.amount_paid != null ? currency(Number(reference.amount_paid)) : "—"}</td>
                  <td>{reference.balance_remaining != null ? currency(Number(reference.balance_remaining)) : "—"}</td>
                </tr>
              ))}
              {!referenceRows.length ? <tr><td colSpan={5}>No HoneyBook references linked yet.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

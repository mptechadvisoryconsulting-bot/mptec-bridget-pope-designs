import { redirect } from "next/navigation";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeadQueueActions } from "@/lib/admin/lead-queue-actions";
import {
  archiveLead,
  convertLeadToClient,
  markLeadContacted,
  scheduleLeadConsultation,
} from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  lead_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  event_type: string;
  event_date?: string | null;
  estimated_budget?: string | null;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; id?: string; status?: string }>;
}) {
  const { action, id, status: statusFilter } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action && id) {
    if (action === "contacted") await markLeadContacted(supabase, id, profile?.id);
    if (action === "schedule") await scheduleLeadConsultation(supabase, id, profile?.id);
    if (action === "convert") await convertLeadToClient(supabase, id, profile?.id);
    if (action === "archive") await archiveLead(supabase, id, profile?.id);
    redirect(statusFilter ? `/admin/leads?status=${statusFilter}` : "/admin/leads");
  }

  let query = supabase
    .from("leads")
    .select("id,lead_number,first_name,last_name,email,phone,event_type,event_date,estimated_budget,source,status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data } = await query;
  const leads = (data ?? []) as LeadRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">CRM</span>
          <h1>Consultation Requests</h1>
          <p className="mini-meta">Public inquiry submissions, contact details, event goals, and pipeline status.</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/leads" variant={statusFilter ? "light" : "primary"}>All</ButtonLink>
          <ButtonLink href="/admin/leads?status=new" variant={statusFilter === "new" ? "primary" : "light"}>New</ButtonLink>
        </div>
      </div>

      <section className="panel">
        <h2>{leads.length} Request{leads.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Prospect</th>
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const { primaryAction, actions } = getLeadQueueActions(lead, statusFilter);
              return (
                <tr key={lead.id}>
                  <td>
                    <a href={`/admin/leads/${lead.id}`}>{lead.first_name} {lead.last_name}</a>
                    <div className="mini-meta">{lead.email}</div>
                  </td>
                  <td>
                    {lead.event_type}
                    <div className="mini-meta">{(lead.source || "public_website").replace(/_/g, " ")}</div>
                  </td>
                  <td>
                    {formatDate(lead.event_date, "Date pending")}
                    <div className="mini-meta">Submitted {formatDateTime(lead.created_at)}</div>
                  </td>
                  <td><StatusBadge status={lead.status} /></td>
                  <td>
                    <QueueItemActions primaryAction={primaryAction} actions={actions} />
                  </td>
                </tr>
              );
            })}
            {!leads.length ? (
              <tr>
                <td colSpan={5}>
                  <strong>No consultation requests yet</strong>
                  <div className="mini-meta">New landing-page inquiries will appear here as soon as the public form is submitted.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

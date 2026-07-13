import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveLead, convertLeadToClient, markLeadContacted, scheduleLeadConsultation } from "@/lib/admin/workflow";

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

const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  consultation_scheduled: "Consultation Scheduled",
  consultation_completed: "Consultation Completed",
  proposal_preparing: "Proposal Preparing",
  proposal_sent: "Proposal Sent",
  awaiting_approval: "Awaiting Approval",
  awaiting_contract: "Awaiting Contract",
  awaiting_deposit: "Awaiting Deposit",
  converted: "Converted",
  lost: "Lost",
  archived: "Archived",
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
              <th>Budget</th>
              <th>Source</th>
              <th>Submitted</th>
              <th>Last Contact</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const lastContact = lead.status !== "new" ? formatDateTime(lead.updated_at) : "No contact yet";
              return (
                <tr key={lead.id}>
                  <td>
                    <a href={`/admin/leads/${lead.id}`}>{lead.first_name} {lead.last_name}</a>
                    <div className="mini-meta">{lead.email} · {lead.phone}</div>
                  </td>
                  <td>{lead.event_type}</td>
                  <td>{formatDate(lead.event_date, "Date pending")}</td>
                  <td>{lead.estimated_budget || "Not set"}</td>
                  <td>{(lead.source || "public_website").replace(/_/g, " ")}</td>
                  <td>{formatDateTime(lead.created_at)}</td>
                  <td>{lastContact}</td>
                  <td><span className="status">{statusLabels[lead.status] ?? lead.status}</span></td>
                  <td>
                    <div className="topbar-actions">
                      <ButtonLink href={`/admin/leads?action=contacted&id=${lead.id}${statusFilter ? `&status=${statusFilter}` : ""}`} variant="light">Mark Contacted</ButtonLink>
                      <ButtonLink href={`/admin/leads?action=schedule&id=${lead.id}${statusFilter ? `&status=${statusFilter}` : ""}`} variant="light">Schedule</ButtonLink>
                      <ButtonLink href={`/admin/leads?action=convert&id=${lead.id}${statusFilter ? `&status=${statusFilter}` : ""}`} variant="light">Convert</ButtonLink>
                      <ButtonLink href={`/admin/leads?action=archive&id=${lead.id}${statusFilter ? `&status=${statusFilter}` : ""}`} variant="light">Archive</ButtonLink>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!leads.length ? (
              <tr>
                <td colSpan={9}>
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

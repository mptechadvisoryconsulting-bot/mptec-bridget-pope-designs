import { redirect } from "next/navigation";
import { BulkDeleteTestLeads } from "@/components/admin/BulkDeleteTestLeads";
import { ContactLinks } from "@/components/admin/ContactLinks";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { TestDataFilterBar } from "@/components/admin/TestDataFilterBar";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeadQueueActions } from "@/lib/admin/lead-queue-actions";
import { isLikelyTestRecord } from "@/lib/admin/test-data";
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
  searchParams: Promise<{
    action?: string;
    id?: string;
    status?: string;
    filter?: string;
    scheduledAt?: string;
    meetingType?: string;
  }>;
}) {
  const { action, id, status: statusFilter, filter, scheduledAt, meetingType } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  const listQuery = (() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (filter) params.set("filter", filter);
    const qs = params.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  })();

  if (action && id) {
    if (action === "contacted") await markLeadContacted(supabase, id, profile?.id);
    if (action === "schedule") await scheduleLeadConsultation(supabase, id, profile?.id, { scheduledAt, meetingType });
    if (action === "convert") await convertLeadToClient(supabase, id, profile?.id);
    if (action === "archive") await archiveLead(supabase, id, profile?.id);
    redirect(listQuery);
  }

  let query = supabase
    .from("leads")
    .select("id,lead_number,first_name,last_name,email,phone,event_type,event_date,estimated_budget,source,status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter === "follow_up") {
    query = query.in("status", ["contacted", "consultation_scheduled"]);
  } else if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;
  const leads = (data ?? []) as LeadRow[];

  const annotated = leads.map((lead) => {
    const name = `${lead.first_name} ${lead.last_name}`.trim();
    const likelyTest = isLikelyTestRecord({
      email: lead.email,
      firstName: lead.first_name,
      lastName: lead.last_name,
      name,
    });
    return { ...lead, name, likelyTest };
  });

  const testCount = annotated.filter((lead) => lead.likelyTest).length;
  const visible = filter === "test" ? annotated.filter((lead) => lead.likelyTest) : annotated;
  const testLeads = annotated
    .filter((lead) => lead.likelyTest)
    .map((lead) => ({ id: lead.id, name: lead.name, email: lead.email }));

  const statusBase = filter === "test" ? "/admin/leads?filter=test" : "/admin/leads";
  const withStatus = (status?: string) => {
    if (!status) return statusBase;
    if (filter === "test") return `/admin/leads?status=${status}&filter=test`;
    return `/admin/leads?status=${status}`;
  };

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">CRM</span>
          <h1>Consultation Requests</h1>
          <p className="mini-meta">Public inquiry submissions, contact details, event goals, and pipeline status.</p>
        </div>
        <div className="topbar-actions" style={{ flexWrap: "wrap" }}>
          <ButtonLink href={withStatus()} variant={statusFilter ? "light" : "primary"}>
            All
          </ButtonLink>
          <ButtonLink href={withStatus("new")} variant={statusFilter === "new" ? "primary" : "light"}>
            New
          </ButtonLink>
          <ButtonLink href={withStatus("follow_up")} variant={statusFilter === "follow_up" ? "primary" : "light"}>
            Follow-up
          </ButtonLink>
          <TestDataFilterBar
            activeFilter={filter}
            basePath={statusFilter ? `/admin/leads?status=${statusFilter}` : "/admin/leads"}
            testCount={testCount}
            totalCount={annotated.length}
          />
        </div>
      </div>

      {filter === "test" ? <BulkDeleteTestLeads leads={testLeads} redirectTo={listQuery} /> : null}

      <section className="panel">
        <h2>
          {visible.length} Request{visible.length === 1 ? "" : "s"}
          {filter === "test" ? " (Test / E2E)" : ""}
        </h2>
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
            {visible.map((lead) => {
              const { primaryAction, actions } = getLeadQueueActions(lead, statusFilter);
              return (
                <tr key={lead.id}>
                  <td>
                    <a href={`/admin/leads/${lead.id}`}>
                      {lead.first_name} {lead.last_name}
                    </a>
                    <ContactLinks email={lead.email} phone={lead.phone} />
                    {lead.likelyTest ? <div className="mini-meta">Test / E2E</div> : null}
                  </td>
                  <td>
                    {lead.event_type}
                    <div className="mini-meta">{(lead.source || "public_website").replace(/_/g, " ")}</div>
                  </td>
                  <td>
                    {formatDate(lead.event_date, "Date pending")}
                    <div className="mini-meta">Submitted {formatDateTime(lead.created_at)}</div>
                  </td>
                  <td>
                    <StatusBadge status={lead.status} />
                  </td>
                  <td>
                    <QueueItemActions primaryAction={primaryAction} actions={actions} />
                  </td>
                </tr>
              );
            })}
            {!visible.length ? (
              <tr>
                <td colSpan={5}>
                  <strong>{filter === "test" ? "No test / E2E leads found" : "No consultation requests yet"}</strong>
                  <div className="mini-meta">
                    {filter === "test"
                      ? "Nothing matches e2e. emails or E2E / FullFlow / Audit name patterns."
                      : "New landing-page inquiries will appear here as soon as the public form is submitted."}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

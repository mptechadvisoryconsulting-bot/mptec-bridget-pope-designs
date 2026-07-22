import { notFound, redirect } from "next/navigation";
import { ProjectPipelineActions } from "@/components/admin/ProjectPipelineActions";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { ScheduleAvailability } from "@/components/admin/ScheduleAvailability";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeadDetailActions } from "@/lib/admin/lead-queue-actions";
import {
  archiveLead,
  completeLeadConsultation,
  convertLeadToClient,
  declineLead,
  leadStatusLabels,
  markLeadAwaitingApproval,
  markLeadContacted,
  markLeadLost,
  scheduleLeadConsultation,
} from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

function toDateTimeInputValue(value?: string | null) {
  if (!value) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 2);
    fallback.setHours(10, 0, 0, 0);
    const offsetMs = fallback.getTimezoneOffset() * 60000;
    return new Date(fallback.getTime() - offsetMs).toISOString().slice(0, 16);
  }
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ action?: string; scheduledAt?: string; meetingType?: string }>;
}) {
  const { leadId } = await params;
  const { action, scheduledAt, meetingType } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action) {
    if (action === "contacted") await markLeadContacted(supabase, leadId, profile?.id);
    if (action === "schedule") await scheduleLeadConsultation(supabase, leadId, profile?.id, { scheduledAt, meetingType });
    if (action === "complete-consultation") await completeLeadConsultation(supabase, leadId, profile?.id);
    if (action === "awaiting-approval") await markLeadAwaitingApproval(supabase, leadId, profile?.id);
    if (action === "convert") await convertLeadToClient(supabase, leadId, profile?.id);
    if (action === "decline") await declineLead(supabase, leadId, profile?.id);
    if (action === "lost") await markLeadLost(supabase, leadId, profile?.id);
    if (action === "archive") await archiveLead(supabase, leadId, profile?.id);
    redirect(`/admin/leads/${leadId}`);
  }

  const [{ data: lead }, { data: client }, { data: project }, { data: consultation }, busyResult] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
    supabase.from("clients").select("id").eq("lead_id", leadId).maybeSingle(),
    supabase.from("projects").select("id,event_name,status,pipeline_stage").eq("lead_id", leadId).maybeSingle(),
    supabase
      .from("consultations")
      .select("id,scheduled_at,meeting_type,status")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("consultations")
      .select("scheduled_at")
      .not("scheduled_at", "is", null)
      .in("status", ["requested", "scheduled"])
      .limit(200),
  ]);

  if (!lead) notFound();

  if (busyResult.error) {
    console.error("lead_detail_busy_query_failed", busyResult.error);
  }

  const { primaryAction, actions } = getLeadDetailActions(leadId, lead.status);
  const busyDates = (busyResult.data ?? [])
    .map((row) => row.scheduled_at)
    .filter((value): value is string => Boolean(value));

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">CRM · {lead.lead_number}</span>
          <h1>{lead.first_name} {lead.last_name}</h1>
          <p className="mini-meta">
            {lead.event_type} · {formatDate(lead.event_date, "Date pending")} ·{" "}
            <span className="status">{leadStatusLabels[lead.status] ?? lead.status}</span>
          </p>
        </div>
        <div className="topbar-actions compact">
          <QueueItemActions primaryAction={primaryAction} actions={actions} />
          {project ? <ButtonLink href={`/admin/projects/${project.id}`} variant="quiet">Open project</ButtonLink> : null}
          {client ? <ButtonLink href={`/admin/clients/${client.id}`} variant="quiet">Open client</ButtonLink> : null}
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel span-2">
          <h2>Consultation Request</h2>
          <dl className="resource-details">
            <div><dt>Submitted</dt><dd>{formatDateTime(lead.created_at)}</dd></div>
            <div>
              <dt>Email</dt>
              <dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "Not set"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                {lead.phone ? (
                  <a href={`tel:${String(lead.phone).replace(/[^\d+]/g, "")}`}>{lead.phone}</a>
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
            <div><dt>Event Type</dt><dd>{lead.event_type}</dd></div>
            <div><dt>Event Date</dt><dd>{formatDate(lead.event_date, "Date pending")}</dd></div>
            <div><dt>Venue</dt><dd>{lead.venue || "Not set"}</dd></div>
            <div><dt>City</dt><dd>{lead.city || "Not set"}</dd></div>
            <div><dt>Guest Count</dt><dd>{lead.guest_count ?? "Not set"}</dd></div>
            <div><dt>Budget</dt><dd>{lead.estimated_budget || "Not set"}</dd></div>
            <div><dt>Colors / Theme</dt><dd>{[lead.event_colors, lead.event_theme].filter(Boolean).join(" · ") || "Not set"}</dd></div>
            <div><dt>Services Needed</dt><dd>{(lead.services_needed ?? []).join(", ") || "Not set"}</dd></div>
            <div><dt>Preferred Consultation</dt><dd>{[lead.preferred_consultation_method, lead.preferred_consultation_date].filter(Boolean).join(" · ") || "Not set"}</dd></div>
            <div><dt>Source</dt><dd>{(lead.source || "public_website").replace(/_/g, " ")}</dd></div>
          </dl>
          {lead.message ? (
            <>
              <h2 style={{ marginTop: 22 }}>Request Notes</h2>
              <p className="mini-meta">{lead.message}</p>
            </>
          ) : null}
        </section>

        <section className="panel">
          <h2>Pipeline Progress</h2>
          <ul className="list">
            <li><span>Contacted</span><span className="status">{lead.status === "new" ? "Pending" : "Done"}</span></li>
            <li>
              <span>Consultation</span>
              <span className="status">{consultation ? leadStatusLabels[consultation.status] ?? consultation.status : "Not scheduled"}</span>
            </li>
            <li><span>Client Record</span><span className="status">{client ? "Created" : "Not created"}</span></li>
            <li><span>Project</span><span className="status">{project ? project.status : "Not created"}</span></li>
          </ul>
          {consultation?.scheduled_at ? (
            <p className="mini-meta">Next consultation: {formatDateTime(consultation.scheduled_at)} ({consultation.meeting_type ?? "method pending"})</p>
          ) : null}
        </section>

        <ScheduleAvailability busyDates={busyDates} />

        <section className="panel span-2" id="schedule">
          <h2>Schedule consultation</h2>
          <p className="mini-meta">Pick a date and time using the availability calendar above. This updates the Consultations page and the lead status together.</p>
          <form action={`/admin/leads/${leadId}`} method="get" className="queue-row-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <input type="hidden" name="action" value="schedule" />
            <input
              aria-label="Consultation date and time"
              className="input"
              defaultValue={toDateTimeInputValue(consultation?.scheduled_at)}
              name="scheduledAt"
              required
              style={{ minHeight: 36, padding: "6px 8px", width: "auto" }}
              type="datetime-local"
            />
            <select
              aria-label="Meeting type"
              className="input"
              defaultValue={consultation?.meeting_type ?? lead.preferred_consultation_method ?? "video"}
              name="meetingType"
              style={{ minHeight: 36, padding: "6px 8px", width: "auto" }}
            >
              <option value="phone">Phone</option>
              <option value="video">Video</option>
              <option value="in_person">In Person</option>
            </select>
            <button className="btn btn-primary" type="submit">
              {consultation ? "Save consultation time" : "Schedule consultation"}
            </button>
          </form>
        </section>

        <section className="panel span-2">
          <h2>Sales Pipeline</h2>
          <ProjectPipelineActions
            convertFirstHref={!project ? `/admin/leads/${leadId}?action=convert` : null}
            pipelineStage={project?.pipeline_stage}
            projectId={project?.id}
          />
        </section>
      </div>
    </div>
  );
}

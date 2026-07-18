import { notFound, redirect } from "next/navigation";
import { ProjectPipelineActions } from "@/components/admin/ProjectPipelineActions";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
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

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { leadId } = await params;
  const { action } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action) {
    if (action === "contacted") await markLeadContacted(supabase, leadId, profile?.id);
    if (action === "schedule") await scheduleLeadConsultation(supabase, leadId, profile?.id);
    if (action === "complete-consultation") await completeLeadConsultation(supabase, leadId, profile?.id);
    if (action === "awaiting-approval") await markLeadAwaitingApproval(supabase, leadId, profile?.id);
    if (action === "convert") await convertLeadToClient(supabase, leadId, profile?.id);
    if (action === "decline") await declineLead(supabase, leadId, profile?.id);
    if (action === "lost") await markLeadLost(supabase, leadId, profile?.id);
    if (action === "archive") await archiveLead(supabase, leadId, profile?.id);
    redirect(`/admin/leads/${leadId}`);
  }

  const [{ data: lead }, { data: client }, { data: project }, { data: consultation }] = await Promise.all([
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
  ]);

  if (!lead) notFound();

  const { primaryAction, actions } = getLeadDetailActions(leadId, lead.status);

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
            <div><dt>Email</dt><dd>{lead.email}</dd></div>
            <div><dt>Phone</dt><dd>{lead.phone}</dd></div>
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

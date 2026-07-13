import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { completeConsultation, convertConsultationLead, scheduleConsultation } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type LeadRef = { first_name?: string | null; last_name?: string | null; event_type?: string | null };
type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type ProjectRef = { event_name?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };

type ConsultationRow = {
  id: string;
  scheduled_at?: string | null;
  meeting_type?: string | null;
  location?: string | null;
  status: string;
  notes?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  bpd_leads?: LeadRef | LeadRef[] | null;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
};

const statusLabels: Record<string, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

function toDateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; id?: string; scheduledAt?: string; meetingType?: string; location?: string }>;
}) {
  const { action, id, scheduledAt, meetingType, location } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action && id) {
    if (action === "schedule") await scheduleConsultation(supabase, id, profile?.id, { scheduledAt, meetingType, location });
    if (action === "complete") await completeConsultation(supabase, id, profile?.id);
    if (action === "convert") await convertConsultationLead(supabase, id, profile?.id);
    redirect("/admin/consultations");
  }

  const { data } = await supabase
    .from("consultations")
    .select("id,scheduled_at,meeting_type,location,status,notes,lead_id,project_id,bpd_leads(first_name,last_name,event_type),bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name)))")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const consultations = (data ?? []) as ConsultationRow[];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Scheduling</span>
          <h1>Consultations</h1>
          <p className="mini-meta">Requested and scheduled consultations created from landing-page inquiries.</p>
        </div>
      </div>

      <section className="panel">
        <h2>{consultations.length} Consultation{consultations.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Prospect / Client</th>
              <th>Event</th>
              <th>Date</th>
              <th>Method</th>
              <th>Status</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {consultations.map((consultation) => {
              const lead = first(consultation.bpd_leads);
              const project = first(consultation.bpd_projects);
              const client = first(project?.bpd_clients);
              const clientProfile = first(client?.bpd_profiles);
              const name = lead
                ? [lead.first_name, lead.last_name].filter(Boolean).join(" ")
                : [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "Client";
              const eventLabel = lead?.event_type || project?.event_name || "Event pending";

              return (
                <tr key={consultation.id}>
                  <td>{name}</td>
                  <td>{eventLabel}</td>
                  <td>{formatDateTime(consultation.scheduled_at, "Not scheduled")}</td>
                  <td>{consultation.meeting_type ? consultation.meeting_type.replace(/_/g, " ") : consultation.location || "Not set"}</td>
                  <td><span className="status">{statusLabels[consultation.status] ?? consultation.status}</span></td>
                  <td>{consultation.notes || "—"}</td>
                  <td>
                    <form action="/admin/consultations" method="get" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="action" value="schedule" />
                      <input type="hidden" name="id" value={consultation.id} />
                      <input className="input" defaultValue={toDateTimeInputValue(consultation.scheduled_at)} name="scheduledAt" style={{ padding: "6px 8px" }} type="datetime-local" />
                      <select className="input" defaultValue={consultation.meeting_type ?? "video"} name="meetingType" style={{ padding: "6px 8px" }}>
                        <option value="phone">Phone</option>
                        <option value="video">Video</option>
                        <option value="in_person">In Person</option>
                      </select>
                      <button className="btn btn-light" type="submit">{consultation.status === "requested" ? "Schedule" : "Reschedule"}</button>
                    </form>
                    <div className="topbar-actions" style={{ marginTop: 8 }}>
                      <ButtonLink href={`/admin/consultations?action=complete&id=${consultation.id}`} variant="light">Complete</ButtonLink>
                      {consultation.lead_id ? (
                        <ButtonLink href={`/admin/consultations?action=convert&id=${consultation.id}`} variant="light">Convert</ButtonLink>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!consultations.length ? (
              <tr>
                <td colSpan={7}>
                  <strong>No consultations scheduled</strong>
                  <div className="mini-meta">New inquiry submissions create requested consultations until the owner schedules a time.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

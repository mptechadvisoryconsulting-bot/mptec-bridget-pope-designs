import { redirect } from "next/navigation";
import { ContactLinks } from "@/components/admin/ContactLinks";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { ScheduleAvailability } from "@/components/admin/ScheduleAvailability";
import { formatDateTime } from "@/lib/dates";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { completeConsultation, convertConsultationLead, scheduleConsultation } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type LeadRef = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  event_type?: string | null;
};
type ProfileRef = { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null };
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

const consultationSelect =
  "id,scheduled_at,meeting_type,location,status,notes,lead_id,project_id,created_at,bpd_leads(first_name,last_name,email,phone,event_type),bpd_projects(event_name,bpd_clients(bpd_profiles(first_name,last_name,email,phone)))";

function toDateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function loadConsultations(supabase: ReturnType<typeof createAdminClient>) {
  const embedded = await supabase
    .from("consultations")
    .select(consultationSelect)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (!embedded.error) {
    return { consultations: (embedded.data ?? []) as ConsultationRow[], queryError: null as string | null };
  }

  console.error("consultations_query_failed", embedded.error);

  const fallback = await supabase
    .from("consultations")
    .select("id,scheduled_at,meeting_type,location,status,notes,lead_id,project_id,created_at")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (fallback.error) {
    console.error("consultations_fallback_query_failed", fallback.error);
    return { consultations: [] as ConsultationRow[], queryError: fallback.error.message };
  }

  return {
    consultations: (fallback.data ?? []) as ConsultationRow[],
    queryError: `Could not load related contact details (${embedded.error.message}). Showing consultation rows only.`,
  };
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

  const [{ consultations, queryError }, busyResult] = await Promise.all([
    loadConsultations(supabase),
    supabase
      .from("consultations")
      .select("scheduled_at")
      .not("scheduled_at", "is", null)
      .in("status", ["requested", "scheduled"])
      .limit(200),
  ]);

  if (busyResult.error) {
    console.error("consultations_busy_query_failed", busyResult.error);
  }

  const busyDates = (busyResult.data ?? [])
    .map((row) => row.scheduled_at)
    .filter((value): value is string => Boolean(value));

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Scheduling</span>
          <h1>Consultations</h1>
          <p className="mini-meta">Requested and scheduled consultations created from landing-page inquiries.</p>
        </div>
      </div>

      {queryError ? (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--danger, #b42318)" }}>
          <strong>Consultations query warning</strong>
          <div className="mini-meta">{queryError}</div>
        </section>
      ) : null}

      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <ScheduleAvailability busyDates={busyDates} />
      </div>

      <section className="panel">
        <h2>{consultations.length} Consultation{consultations.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Prospect / Client</th>
              <th>Event</th>
              <th>When</th>
              <th>Status</th>
              <th aria-label="Actions" />
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
              const email = lead?.email || clientProfile?.email;
              const phone = lead?.phone || clientProfile?.phone;
              const secondaryActions = [
                { label: "Complete", href: `/admin/consultations?action=complete&id=${consultation.id}` },
                ...(consultation.lead_id
                  ? [{ label: "Convert to client", href: `/admin/consultations?action=convert&id=${consultation.id}` }]
                  : []),
              ];

              return (
                <tr key={consultation.id}>
                  <td>
                    <strong style={{ fontWeight: 600 }}>{name}</strong>
                    <ContactLinks email={email} phone={phone} />
                    {consultation.notes ? <div className="mini-meta">{consultation.notes}</div> : null}
                  </td>
                  <td>{eventLabel}</td>
                  <td>
                    {formatDateTime(consultation.scheduled_at, "Not scheduled")}
                    <div className="mini-meta">
                      {consultation.meeting_type ? consultation.meeting_type.replace(/_/g, " ") : consultation.location || "Method pending"}
                    </div>
                  </td>
                  <td><span className="status">{statusLabels[consultation.status] ?? consultation.status}</span></td>
                  <td>
                    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                      <form action="/admin/consultations" method="get" className="queue-row-actions">
                        <input type="hidden" name="action" value="schedule" />
                        <input type="hidden" name="id" value={consultation.id} />
                        <input
                          aria-label="Consultation date and time"
                          className="input"
                          defaultValue={toDateTimeInputValue(consultation.scheduled_at)}
                          name="scheduledAt"
                          required
                          style={{ minHeight: 36, padding: "6px 8px", width: "auto" }}
                          type="datetime-local"
                        />
                        <select
                          aria-label="Meeting type"
                          className="input"
                          defaultValue={consultation.meeting_type ?? "video"}
                          name="meetingType"
                          style={{ minHeight: 36, padding: "6px 8px", width: "auto" }}
                        >
                          <option value="phone">Phone</option>
                          <option value="video">Video</option>
                          <option value="in_person">In Person</option>
                        </select>
                        <button className="btn btn-quiet" type="submit">
                          {consultation.status === "requested" ? "Schedule" : "Reschedule"}
                        </button>
                      </form>
                      <QueueItemActions actions={secondaryActions} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!consultations.length ? (
              <tr>
                <td colSpan={5}>
                  <strong>No consultations scheduled</strong>
                  <div className="mini-meta">
                    {queryError
                      ? "A database error prevented loading consultations. Check server logs for consultations_query_failed."
                      : "New inquiry submissions create requested consultations until the owner schedules a time."}
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

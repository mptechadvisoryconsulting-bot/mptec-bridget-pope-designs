import { CalendarView } from "@/components/admin/CalendarView";
import type { CalendarAgendaItem } from "@/components/admin/MonthCalendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type LeadRef = { first_name?: string | null; last_name?: string | null; event_type?: string | null };
type ProjectNameRef = { event_name?: string | null };

type ConsultationAgendaRow = {
  id: string;
  scheduled_at: string;
  meeting_type?: string | null;
  status: string;
  bpd_leads?: LeadRef | LeadRef[] | null;
  bpd_projects?: ProjectNameRef | ProjectNameRef[] | null;
};

type ProjectAgendaRow = {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  venue_name?: string | null;
  status: string;
  bpd_clients?: ClientRef | ClientRef[] | null;
};

type TaskAgendaRow = { id: string; title: string; due_date: string; priority: string };
type CalendarEventRow = { id: string; title: string; event_type?: string | null; starts_at: string; location?: string | null };

export default async function CalendarPage() {
  const supabase = createAdminClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const lookback = new Date(monthStart);
  lookback.setMonth(lookback.getMonth() - 1);

  const [{ data: consultations, error: consultationsError }, { data: projects, error: projectsError }, { data: tasks, error: tasksError }, calendarResult] =
    await Promise.all([
      supabase
        .from("consultations")
        .select("id,scheduled_at,meeting_type,status,bpd_leads(first_name,last_name,event_type),bpd_projects(event_name)")
        .not("scheduled_at", "is", null)
        .in("status", ["requested", "scheduled"])
        .gte("scheduled_at", lookback.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(200),
      supabase
        .from("projects")
        .select("id,event_name,event_type,event_date,venue_name,status,bpd_clients(bpd_profiles(first_name,last_name))")
        .gte("event_date", lookback.toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .limit(200),
      supabase
        .from("tasks")
        .select("id,title,due_date,priority")
        .neq("status", "complete")
        .not("due_date", "is", null)
        .gte("due_date", lookback.toISOString().slice(0, 10))
        .order("due_date", { ascending: true })
        .limit(200),
      supabase
        .from("calendar_events")
        .select("id,title,event_type,starts_at,location")
        .gte("starts_at", lookback.toISOString())
        .order("starts_at", { ascending: true })
        .limit(200),
    ]);

  if (consultationsError) console.error("calendar_consultations_query_failed", consultationsError);
  if (projectsError) console.error("calendar_projects_query_failed", projectsError);
  if (tasksError) console.error("calendar_tasks_query_failed", tasksError);
  if (calendarResult.error) console.error("calendar_events_query_failed", calendarResult.error);

  const items: CalendarAgendaItem[] = [];

  for (const consultation of (consultations ?? []) as ConsultationAgendaRow[]) {
    const lead = first(consultation.bpd_leads);
    const project = first(consultation.bpd_projects);
    const name = lead ? [lead.first_name, lead.last_name].filter(Boolean).join(" ") : project?.event_name ?? "Consultation";
    items.push({
      id: `consultation-${consultation.id}`,
      at: consultation.scheduled_at,
      title: `Consultation · ${name}`,
      detail: `${(consultation.meeting_type ?? "Method pending").replace(/_/g, " ")} · ${consultation.status}`,
      kind: "consultation",
    });
  }

  for (const project of (projects ?? []) as ProjectAgendaRow[]) {
    const client = first(project.bpd_clients);
    const clientProfile = first(client?.bpd_profiles);
    const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ");
    items.push({
      id: `project-${project.id}`,
      at: `${project.event_date}T09:00:00`,
      title: `${project.event_type} · ${project.event_name}`,
      detail: `${clientName || "Client"} · ${project.venue_name || "Venue pending"} · ${project.status.replace(/_/g, " ")}`,
      kind: "event",
    });
  }

  for (const task of (tasks ?? []) as TaskAgendaRow[]) {
    items.push({
      id: `task-${task.id}`,
      at: `${task.due_date}T17:00:00`,
      title: `Task Due · ${task.title}`,
      detail: `Priority: ${task.priority}`,
      kind: "task",
    });
  }

  for (const event of (calendarResult.data ?? []) as CalendarEventRow[]) {
    items.push({
      id: `calendar-${event.id}`,
      at: event.starts_at,
      title: event.title,
      detail: `${(event.event_type ?? "Reminder").replace(/_/g, " ")} · ${event.location || "Location pending"}`,
      kind: "custom",
    });
  }

  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Scheduling</span>
          <h1>Calendar</h1>
          <p className="mini-meta">Month grid of consultations, event dates, and task deadlines. Switch to list for the classic agenda.</p>
        </div>
      </div>

      <CalendarView items={items} />
    </div>
  );
}

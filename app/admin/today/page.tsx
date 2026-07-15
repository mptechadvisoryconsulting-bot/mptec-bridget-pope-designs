import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminTodayPage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const next20 = new Date();
  next20.setDate(next20.getDate() + 20);
  const next20Date = next20.toISOString().slice(0, 10);

  const [
    { data: leads },
    { data: consultations },
    { data: messages },
    { data: designActions },
    { data: upcomingProjects },
    { data: tasks },
    { data: honeybookReviews },
  ] = await Promise.all([
    supabase.from("leads").select("id,first_name,last_name,event_type,event_date,city,created_at").eq("status", "new").order("created_at", { ascending: false }).limit(8),
    supabase.from("consultations").select("id,scheduled_at,meeting_type,status,bpd_leads(first_name,last_name,event_type)").gte("scheduled_at", `${today}T00:00:00`).lt("scheduled_at", `${today}T23:59:59`).order("scheduled_at", { ascending: true }),
    supabase.from("messages").select("id,body,created_at,conversations(project_id)").is("read_at", null).order("created_at", { ascending: false }).limit(8),
    supabase.from("design_updates").select("id,project_id,title,client_action_status,client_action_due_date").eq("requires_client_action", true).in("client_action_status", ["pending", "overdue"]).order("client_action_due_date", { ascending: true }).limit(8),
    supabase.from("projects").select("id,event_name,event_date,status").gte("event_date", today).lte("event_date", next20Date).order("event_date", { ascending: true }).limit(8),
    supabase.from("tasks").select("id,title,due_date,status").neq("status", "complete").lte("due_date", `${today}T23:59:59`).order("due_date", { ascending: true }).limit(8),
    supabase.from("honeybook_financial_references").select("id,project_id,honeybook_invoice_number,updated_at").eq("review_status", "needs_review").order("updated_at", { ascending: false }).limit(8),
  ]);

  const cards = [
    ["New Leads", leads?.length ?? 0],
    ["Today's Consultations", consultations?.length ?? 0],
    ["Unread Messages", messages?.length ?? 0],
    ["Client Actions", designActions?.length ?? 0],
    ["Events Next 20 Days", upcomingProjects?.length ?? 0],
    ["Tasks Due", tasks?.length ?? 0],
    ["HoneyBook Review", honeybookReviews?.length ?? 0],
  ];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Today</span>
          <h1>What Bridget Needs To Handle</h1>
          <p className="mini-meta">A focused operating queue for leads, client actions, events, and HoneyBook references.</p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Today summary">
        {cards.map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Needs attention</small>
          </article>
        ))}
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>New Leads</h2>
          <ul className="list">
            {(leads ?? []).map((lead) => (
              <li key={lead.id}>
                <span>{lead.first_name} {lead.last_name}<span className="mini-meta">{lead.event_type} · {formatDate(lead.event_date, "Date pending")} · {lead.city || "Location pending"}</span></span>
                <ButtonLink href={`/admin/leads/${lead.id}`} variant="light">Review</ButtonLink>
              </li>
            ))}
            {!leads?.length ? <li>No new leads today.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>Today's Consultations</h2>
          <ul className="list">
            {(consultations ?? []).map((consultation) => (
              <li key={consultation.id}>
                <span>{consultation.meeting_type ?? "Consultation"}<span className="mini-meta">{formatDateTime(consultation.scheduled_at)}</span></span>
                <ButtonLink href="/admin/consultations" variant="light">Open</ButtonLink>
              </li>
            ))}
            {!consultations?.length ? <li>No consultations scheduled for today.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>Unread Messages</h2>
          <ul className="list">
            {(messages ?? []).map((message) => (
              <li key={message.id}>
                <span>{message.body?.slice(0, 80) || "Message"}<span className="mini-meta">{formatDateTime(message.created_at)}</span></span>
                <ButtonLink href="/admin/messages" variant="light">Open</ButtonLink>
              </li>
            ))}
            {!messages?.length ? <li>No unread messages.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>HoneyBook References Needing Review</h2>
          <ul className="list">
            {(honeybookReviews ?? []).map((reference) => (
              <li key={reference.id}>
                <span>{reference.honeybook_invoice_number ?? "HoneyBook record"}<span className="mini-meta">{formatDateTime(reference.updated_at)}</span></span>
                <ButtonLink href={`/admin/projects/${reference.project_id}`} variant="light">Match</ButtonLink>
              </li>
            ))}
            {!honeybookReviews?.length ? <li>No HoneyBook records need review.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

import { Bell, CalendarDays, MailCheck, MessageSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { mapEmailReadinessStatus, readinessLabel } from "@/lib/email/delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const next20 = new Date();
  next20.setDate(next20.getDate() + 20);
  const next20Date = next20.toISOString().slice(0, 10);

  const [
    { data: newRequests },
    { data: messages },
    { data: projects },
    { data: designActions },
    { data: honeybookReviews },
    { data: tasks },
    { count: unreadNotifications },
    settingsResult,
    { count: activeClientCount },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id,lead_number,first_name,last_name,email,phone,event_type,event_date,venue,city,estimated_budget,services_needed,preferred_consultation_method,created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("messages")
      .select("id,body,created_at,read_at,conversations(project_id,projects(event_name,clients(profiles(first_name,last_name))))")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("projects")
      .select("id,event_name,event_type,event_date,venue_name,status")
      .gte("event_date", today)
      .lte("event_date", next20Date)
      .order("event_date", { ascending: true })
      .limit(6),
    supabase
      .from("design_updates")
      .select("id,project_id,title,client_action_status,client_action_due_date")
      .eq("requires_client_action", true)
      .in("client_action_status", ["pending", "overdue"])
      .order("client_action_due_date", { ascending: true })
      .limit(6),
    supabase
      .from("honeybook_financial_references")
      .select("id,project_id,honeybook_invoice_number,updated_at")
      .eq("review_status", "needs_review")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("tasks").select("id,title,due_date,status").neq("status", "complete").order("due_date", { ascending: true }).limit(5),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("business_settings")
      .select("business_email,inquiry_recipient_email,email_readiness_status,email_provider_last_error,email_last_test_sent_at,email_last_error")
      .limit(1)
      .maybeSingle(),
    supabase.from("clients").select("id", { count: "exact", head: true }),
  ]);

  const requestRows = newRequests ?? [];
  const messageRows = messages ?? [];
  const projectRows = projects ?? [];
  const designActionRows = designActions ?? [];
  const honeybookRows = honeybookReviews ?? [];
  const taskRows = tasks ?? [];
  const { data: settings } = settingsResult;
  const emailRecipient = settings?.inquiry_recipient_email ?? settings?.business_email;
  const emailReadinessStatus = mapEmailReadinessStatus(
    settings?.email_readiness_status,
    settings?.email_provider_last_error ?? settings?.email_last_error,
  );
  const ownerActionCount = requestRows.length + messageRows.length + designActionRows.length + honeybookRows.length + taskRows.length;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Operating Dashboard</span>
          <h1>Bridget Pope Designs</h1>
          <p className="mini-meta">Leads, consultations, project actions, and HoneyBook references in one operating queue.</p>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" aria-label="Notifications"><Bell size={17} /></button>
          <ButtonLink href="/admin/today" variant="secondary">Open Today</ButtonLink>
        </div>
      </div>

      <section className="stats-grid" aria-label="Owner dashboard statistics">
        <article className="stat-card"><span>New Leads</span><strong>{requestRows.length}</strong><small>Consultation requests</small></article>
        <article className="stat-card"><span>Active Clients</span><strong>{activeClientCount ?? 0}</strong><small>Portal records</small></article>
        <article className="stat-card"><span>Events Next 20 Days</span><strong>{projectRows.length}</strong><small>Project countdowns</small></article>
        <article className="stat-card"><span>Needs Attention</span><strong>{ownerActionCount}</strong><small>Messages, tasks, actions</small></article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel span-2">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Primary Queue</span>
              <h2>New Consultation Requests</h2>
            </div>
            <span className="status">{requestRows.length} new</span>
          </div>
          <ul className="list">
            {requestRows.map((lead) => (
              <li key={lead.id}>
                <div>
                  <strong>{lead.first_name} {lead.last_name}</strong>
                  <div className="mini-meta">Submitted {formatDateTime(lead.created_at)}</div>
                  <div className="mini-meta">{lead.event_type} · {formatDate(lead.event_date, "Date pending")} · {lead.venue || lead.city || "Venue pending"}</div>
                  <div className="mini-meta">{lead.estimated_budget || "Budget pending"} · {(lead.services_needed ?? []).join(", ") || "Services pending"} · {lead.preferred_consultation_method || "Consultation pending"}</div>
                  <div className="mini-meta">{lead.email} · {lead.phone}</div>
                </div>
                <div className="topbar-actions">
                  <ButtonLink href={`/admin/leads/${lead.id}`} variant="light">Open Request</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=contacted`} variant="secondary">Mark Contacted</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=schedule`} variant="light">Schedule Consultation</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=convert`} variant="light">Approve & Create Client</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=archive`} variant="light">Archive</ButtonLink>
                </div>
              </li>
            ))}
            {!requestRows.length ? <li>No new consultation requests are waiting.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>Owner Action Required</h2>
          <ul className="list">
            <li><span>Open actions</span><span className="status">{ownerActionCount}</span></li>
            <li><span>Unread client messages</span><span className="status">{messageRows.length}</span></li>
            <li><span>Client design actions</span><span className="status">{designActionRows.length}</span></li>
            <li><span>HoneyBook records needing review</span><span className="status">{honeybookRows.length}</span></li>
            <li><span>Unread notifications</span><span className="status">{unreadNotifications ?? 0}</span></li>
          </ul>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Unread Client Messages</h2>
            <MessageSquare size={18} />
          </div>
          <ul className="list">
            {messageRows.map((message) => (
              <li key={message.id}>
                <span>{message.body?.slice(0, 72) || "Message"}<span className="mini-meta">{formatDateTime(message.created_at)}</span></span>
                <ButtonLink href="/admin/messages" variant="light">Open</ButtonLink>
              </li>
            ))}
            {!messageRows.length ? <li>No unread client messages.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Upcoming Events</h2>
            <CalendarDays size={18} />
          </div>
          <ul className="list">
            {projectRows.map((project) => (
              <li key={project.id}>
                <span>{project.event_name}<span className="mini-meta">{formatDate(project.event_date, "Date pending")} · {project.venue_name || project.event_type}</span></span>
                <ButtonLink href={`/admin/projects/${project.id}`} variant="light">Open</ButtonLink>
              </li>
            ))}
            {!projectRows.length ? <li>No events in the next 20 days.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>Client Action Required</h2>
          <ul className="list">
            {designActionRows.map((action) => (
              <li key={action.id}>
                <span>{action.title}<span className="mini-meta">{action.client_action_status} · due {formatDate(action.client_action_due_date, "not set")}</span></span>
                <ButtonLink href={`/admin/projects/${action.project_id}`} variant="light">Open</ButtonLink>
              </li>
            ))}
            {!designActionRows.length ? <li>No client design actions are pending.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>HoneyBook Review</h2>
          <ul className="list">
            {honeybookRows.map((reference) => (
              <li key={reference.id}>
                <span>{reference.honeybook_invoice_number ?? "HoneyBook record"}<span className="mini-meta">{formatDateTime(reference.updated_at)}</span></span>
                <ButtonLink href={`/admin/projects/${reference.project_id}`} variant="light">Review</ButtonLink>
              </li>
            ))}
            {!honeybookRows.length ? <li>No HoneyBook references need review.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Email Status</h2>
            <MailCheck size={18} />
          </div>
          <ul className="list">
            <li><span>Readiness</span><span className="status">{readinessLabel(emailReadinessStatus)}</span></li>
            <li><span>Inquiry recipient</span><span className="status">{emailRecipient ?? "Not configured"}</span></li>
            <li><span>Last test</span><span className="status">{settings?.email_last_test_sent_at ? formatDateTime(settings.email_last_test_sent_at) : "None"}</span></li>
          </ul>
          {settings?.email_provider_last_error || settings?.email_last_error ? <p className="form-error">{settings.email_provider_last_error ?? settings.email_last_error}</p> : null}
          <ButtonLink href="/admin/settings" variant="light">Open Email Settings</ButtonLink>
        </section>

        <section className="panel">
          <h2>Tasks</h2>
          <ul className="list">
            {taskRows.map((task) => (
              <li key={task.id}>
                <span>{task.title}<span className="mini-meta">{task.due_date ? formatDateTime(task.due_date) : task.status}</span></span>
                <ButtonLink href="/admin/tasks" variant="light">Open</ButtonLink>
              </li>
            ))}
            {!taskRows.length ? <li>No open tasks.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

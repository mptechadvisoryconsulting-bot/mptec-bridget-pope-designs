import { Bell, CalendarDays, MailCheck, MessageSquare } from "lucide-react";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
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
    { data: openInvoices },
    { data: tasks },
    { data: activityLogs },
    { count: unreadNotifications },
    settingsResult,
    { count: activeClientCount },
    { count: pendingProposalsCount },
    { count: awaitingProposalApprovalCount },
    { count: activeProjectsCount },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id,lead_number,first_name,last_name,email,phone,event_type,event_date,venue,city,estimated_budget,services_needed,preferred_consultation_method,created_at,status")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("messages")
      .select("id,body,created_at,read_at,conversations(project_id,projects(event_name,clients(profiles(first_name,last_name))))")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("projects")
      .select("id,event_name,event_type,event_date,venue_name,status,client_id")
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
      .from("invoices")
      .select("id,invoice_number,balance_due,due_date,status,project_id")
      .gt("balance_due", 0)
      .not("status", "eq", "draft")
      .order("due_date", { ascending: true })
      .limit(6),
    supabase.from("tasks").select("id,title,due_date,status,project_id").neq("status", "complete").order("due_date", { ascending: true }).limit(5),
    supabase
      .from("activity_logs")
      .select("id,action,entity_type,created_at,project_id,lead_id")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("business_settings")
      .select("business_email,inquiry_recipient_email,email_readiness_status,email_provider_last_error,email_last_test_sent_at,email_last_error")
      .limit(1)
      .maybeSingle(),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("proposals").select("id", { count: "exact", head: true }).in("status", ["draft", "sent", "viewed"]),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("pipeline_stage", "proposal_sent"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["booked", "planning", "design_in_progress", "awaiting_client_approval", "finalizing", "ready_for_event"]),
  ]);

  const requestRows = newRequests ?? [];
  const messageRows = messages ?? [];
  const projectRows = projects ?? [];
  const designActionRows = designActions ?? [];
  const invoiceRows = openInvoices ?? [];
  const taskRows = tasks ?? [];
  const activityRows = activityLogs ?? [];
  const { data: settings } = settingsResult;
  const emailRecipient = settings?.inquiry_recipient_email ?? settings?.business_email;
  const emailReadinessStatus = mapEmailReadinessStatus(
    settings?.email_readiness_status,
    settings?.email_provider_last_error ?? settings?.email_last_error,
  );
  const ownerActionCount = requestRows.length + messageRows.length + designActionRows.length + invoiceRows.length + taskRows.length;
  const pendingProposals = Number(pendingProposalsCount ?? 0);
  const awaitingProposalApproval = Number(awaitingProposalApprovalCount ?? 0);
  const activeProjects = Number(activeProjectsCount ?? 0);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Operating Dashboard</span>
          <h1>Bridget Pope Designs</h1>
          <p className="mini-meta">Leads, proposals, invoices, and project actions in one operating queue.</p>
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
        <article className="stat-card"><span>Needs Attention</span><strong>{ownerActionCount}</strong><small>Messages, tasks, invoices</small></article>
        <article className="stat-card"><span>Pending Proposals</span><strong>{pendingProposals}</strong><small>Draft / sent / viewed</small></article>
        <article className="stat-card"><span>Active Projects</span><strong>{activeProjects}</strong><small>In production</small></article>
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
          <div className="queue-card-list" style={{ display: "grid", gap: 12 }}>
            {requestRows.map((lead) => (
              <article
                className="queue-card"
                key={lead.id}
                style={{
                  border: "1px solid var(--border, #e5ddd8)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr auto",
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{lead.first_name} {lead.last_name}</strong>
                    <span className="status">{lead.status}</span>
                  </div>
                  <div className="mini-meta">Submitted {formatDateTime(lead.created_at)}</div>
                  <div className="mini-meta">{lead.event_type} · {formatDate(lead.event_date, "Date pending")} · {lead.venue || lead.city || "Venue pending"}</div>
                  <div className="mini-meta">{lead.email} · {lead.phone}</div>
                </div>
                <QueueItemActions
                  actions={[
                    { label: "View", href: `/admin/leads/${lead.id}` },
                    { label: "Convert", href: `/admin/leads/${lead.id}?action=convert` },
                    { label: "Schedule", href: `/admin/leads/${lead.id}?action=schedule` },
                    { label: "Create Proposal", href: `/admin/proposals/new?leadId=${lead.id}` },
                  ]}
                />
              </article>
            ))}
            {!requestRows.length ? <p className="mini-meta">No new consultation requests are waiting.</p> : null}
          </div>
        </section>

        <section className="panel">
          <h2>Activity Timeline</h2>
          <ul className="list">
            {activityRows.map((item) => (
              <li key={item.id}>
                <span>
                  {item.action.replace(/_/g, " ")}
                  <span className="mini-meta">{formatDateTime(item.created_at)} · {item.entity_type ?? "system"}</span>
                </span>
              </li>
            ))}
            {!activityRows.length ? <li>No recent activity yet.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>Sales Pipeline</h2>
          <ul className="list">
            <li><span>Pending proposals</span><span className="status">{pendingProposals}</span></li>
            <li><span>Proposal sent · awaiting approval</span><span className="status">{awaitingProposalApproval}</span></li>
            <li><span>Open invoices</span><span className="status">{invoiceRows.length}</span></li>
            <li><span>Unread notifications</span><span className="status">{unreadNotifications ?? 0}</span></li>
          </ul>
          <div className="topbar-actions" style={{ marginTop: 12 }}>
            <ButtonLink href="/admin/proposals" variant="light">Proposals</ButtonLink>
            <ButtonLink href="/admin/invoices" variant="light">Invoices</ButtonLink>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Open Invoices</h2>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {invoiceRows.map((invoice) => (
              <article
                key={invoice.id}
                style={{ border: "1px solid var(--border, #e5ddd8)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
              >
                <div>
                  <strong>{invoice.invoice_number}</strong>
                  <div className="mini-meta">{currency(Number(invoice.balance_due ?? 0))} · due {formatDate(invoice.due_date, "n/a")}</div>
                  <span className="status">{invoice.status}</span>
                </div>
                <QueueItemActions
                  actions={[
                    { label: "View", href: `/admin/invoices/${invoice.id}` },
                    { label: "Record Payment", href: `/admin/invoices/${invoice.id}#record-payment` },
                    ...(invoice.project_id
                      ? [{ label: "Create Proposal", href: `/admin/proposals/new?projectId=${invoice.project_id}` }]
                      : []),
                  ]}
                />
              </article>
            ))}
            {!invoiceRows.length ? <p className="mini-meta">No open invoice balances.</p> : null}
          </div>
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
          <div style={{ display: "grid", gap: 10 }}>
            {projectRows.map((project) => (
              <article
                key={project.id}
                style={{ border: "1px solid var(--border, #e5ddd8)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
              >
                <div>
                  <strong>{project.event_name}</strong>
                  <div className="mini-meta">{formatDate(project.event_date, "Date pending")} · {project.venue_name || project.event_type}</div>
                  <span className="status">{project.status}</span>
                </div>
                <QueueItemActions
                  actions={[
                    { label: "View", href: `/admin/projects/${project.id}` },
                    { label: "Create Proposal", href: `/admin/proposals/new?projectId=${project.id}` },
                    { label: "Record Payment", href: `/admin/payments` },
                  ]}
                />
              </article>
            ))}
            {!projectRows.length ? <p className="mini-meta">No events in the next 20 days.</p> : null}
          </div>
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

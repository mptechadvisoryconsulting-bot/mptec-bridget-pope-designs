import { CalendarDays, MessageSquare } from "lucide-react";
import Link from "next/link";
import { QueueItemActions } from "@/components/admin/QueueItemActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
    { count: unreadNotifications },
    settingsResult,
    { count: pendingProposalsCount },
    { count: awaitingProposalApprovalCount },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id,lead_number,first_name,last_name,email,phone,event_type,event_date,venue,city,estimated_budget,services_needed,preferred_consultation_method,created_at,status")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("messages")
      .select(
        "id,body,created_at,read_at,bpd_conversations(project_id,bpd_projects!project_id(event_name,bpd_clients!client_id(bpd_profiles(first_name,last_name))))",
      )
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("projects")
      .select("id,event_name,event_type,event_date,venue_name,status,client_id")
      .gte("event_date", today)
      .lte("event_date", next20Date)
      .order("event_date", { ascending: true })
      .limit(4),
    supabase
      .from("design_updates")
      .select("id,project_id,title,client_action_status,client_action_due_date")
      .eq("requires_client_action", true)
      .in("client_action_status", ["pending", "overdue"])
      .order("client_action_due_date", { ascending: true })
      .limit(4),
    supabase
      .from("invoices")
      .select("id,invoice_number,balance_due,due_date,status,project_id")
      .gt("balance_due", 0)
      .not("status", "eq", "draft")
      .order("due_date", { ascending: true })
      .limit(4),
    supabase.from("tasks").select("id,title,due_date,status,project_id").neq("status", "complete").order("due_date", { ascending: true }).limit(4),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("business_settings")
      .select("business_email,inquiry_recipient_email,email_readiness_status,email_provider_last_error,email_last_test_sent_at,email_last_error")
      .limit(1)
      .maybeSingle(),
    supabase.from("proposals").select("id", { count: "exact", head: true }).in("status", ["draft", "sent", "viewed"]),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("pipeline_stage", "proposal_sent"),
  ]);

  const requestRows = newRequests ?? [];
  const messageRows = messages ?? [];
  const projectRows = projects ?? [];
  const designActionRows = designActions ?? [];
  const invoiceRows = openInvoices ?? [];
  const taskRows = tasks ?? [];
  const { data: settings } = settingsResult;
  const emailReadinessStatus = mapEmailReadinessStatus(
    settings?.email_readiness_status,
    settings?.email_provider_last_error ?? settings?.email_last_error,
  );
  const ownerActionCount = requestRows.length + messageRows.length + designActionRows.length + invoiceRows.length + taskRows.length;
  const pendingProposals = Number(pendingProposalsCount ?? 0);
  const awaitingProposalApproval = Number(awaitingProposalApprovalCount ?? 0);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Action center</span>
          <h1>Today</h1>
          <p className="mini-meta">What needs a decision now — leads, messages, invoices, and events.</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/today" variant="secondary">Today board</ButtonLink>
          <ButtonLink href="/admin/leads?status=new">Review leads</ButtonLink>
        </div>
      </div>

      <section className="stats-grid" aria-label="Owner dashboard statistics">
        <article className="stat-card"><span>Needs attention</span><strong>{ownerActionCount}</strong><small>Open actions</small></article>
        <article className="stat-card"><span>New leads</span><strong>{requestRows.length}</strong><small>Consultation queue</small></article>
        <article className="stat-card"><span>Open invoices</span><strong>{invoiceRows.length}</strong><small>Balances due</small></article>
        <article className="stat-card"><span>Events · 20 days</span><strong>{projectRows.length}</strong><small>Upcoming</small></article>
      </section>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel span-2">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Primary queue</span>
              <h2>New consultation requests</h2>
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
                    <StatusBadge status={lead.status} />
                  </div>
                  <div className="mini-meta">Submitted {formatDateTime(lead.created_at)}</div>
                  <div className="mini-meta">{lead.event_type} · {formatDate(lead.event_date, "Date pending")} · {lead.venue || lead.city || "Venue pending"}</div>
                </div>
                <QueueItemActions
                  primaryAction={{ label: "Review", href: `/admin/leads/${lead.id}` }}
                  actions={[
                    { label: "View details", href: `/admin/leads/${lead.id}` },
                    { label: "Mark contacted", href: `/admin/leads/${lead.id}?action=contacted` },
                    { label: "Approve & create client", href: `/admin/leads/${lead.id}?action=convert` },
                    { label: "Create proposal", href: `/admin/proposals/new?leadId=${lead.id}` },
                  ]}
                />
              </article>
            ))}
            {!requestRows.length ? <p className="mini-meta">No new consultation requests are waiting.</p> : null}
          </div>
        </section>

        <section className="panel">
          <h2>Pipeline snapshot</h2>
          <ul className="list">
            <li><span>Pending proposals</span><span className="status">{pendingProposals}</span></li>
            <li><span>Awaiting approval</span><span className="status">{awaitingProposalApproval}</span></li>
            <li><span>Unread notifications</span><span className="status">{unreadNotifications ?? 0}</span></li>
            <li><span>Email readiness</span><span className="status">{readinessLabel(emailReadinessStatus)}</span></li>
          </ul>
          <div className="topbar-actions" style={{ marginTop: 12 }}>
            <ButtonLink href="/admin/proposals" variant="light">Billing</ButtonLink>
            <ButtonLink href="/admin/settings" variant="light">Settings</ButtonLink>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Open invoices</h2>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {invoiceRows.map((invoice) => (
              <article
                key={invoice.id}
                style={{ border: "1px solid var(--border, #e5ddd8)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
              >
                <div>
                  <strong>
                    <Link href={`/admin/invoices/${invoice.id}`} prefetch={false}>
                      {invoice.invoice_number}
                    </Link>
                  </strong>
                  <div className="mini-meta">{currency(Number(invoice.balance_due ?? 0))} · due {formatDate(invoice.due_date, "n/a")}</div>
                </div>
                <QueueItemActions
                  primaryAction={{ label: "Open", href: `/admin/invoices/${invoice.id}` }}
                  actions={[
                    { label: "View invoice", href: `/admin/invoices/${invoice.id}` },
                    { label: "Record payment", href: `/admin/invoices/${invoice.id}#record-payment` },
                  ]}
                />
              </article>
            ))}
            {!invoiceRows.length ? <p className="mini-meta">No open invoice balances.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Messages</h2>
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
            <h2>Upcoming events</h2>
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
                </div>
                <QueueItemActions
                  primaryAction={{ label: "Open", href: `/admin/projects/${project.id}` }}
                  actions={[
                    { label: "View project", href: `/admin/projects/${project.id}` },
                    { label: "Create proposal", href: `/admin/proposals/new?projectId=${project.id}` },
                  ]}
                />
              </article>
            ))}
            {!projectRows.length ? <p className="mini-meta">No events in the next 20 days.</p> : null}
          </div>
        </section>

        <section className="panel">
          <h2>Client actions & tasks</h2>
          <ul className="list">
            {designActionRows.map((action) => (
              <li key={action.id}>
                <span>{action.title}<span className="mini-meta">Design · due {formatDate(action.client_action_due_date, "not set")}</span></span>
                <ButtonLink href={`/admin/projects/${action.project_id}`} variant="light">Open</ButtonLink>
              </li>
            ))}
            {taskRows.map((task) => (
              <li key={task.id}>
                <span>{task.title}<span className="mini-meta">Task · {task.due_date ? formatDateTime(task.due_date) : task.status}</span></span>
                <ButtonLink href="/admin/tasks" variant="light">Open</ButtonLink>
              </li>
            ))}
            {!designActionRows.length && !taskRows.length ? <li>Nothing waiting on you or the client.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

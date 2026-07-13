import { Bell, CalendarDays, MailCheck, MessageSquare, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { mapEmailReadinessStatus, readinessLabel } from "@/lib/email/delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Date pending";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(value?: string | null) {
  if (!value) return "Time pending";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: newRequests },
    { data: messages },
    { data: projects },
    { data: invoices },
    { data: payments },
    { data: tasks },
    { count: unreadNotifications },
    settingsResult,
    { count: newLeadCount },
    { count: requestedConsultationCount },
    { count: followUpConsultationCount },
    { count: awaitingPortalCount },
    { count: overdueByStatusCount },
    { data: overdueByDateRows },
    { count: unreadClientMessageCount },
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
      .order("event_date", { ascending: true })
      .limit(5),
    supabase
      .from("invoices")
      .select("id,invoice_number,total,amount_paid,balance_due,due_date,status,clients(profiles(first_name,last_name))")
      .gt("balance_due", 0)
      .not("status", "eq", "draft")
      .order("due_date", { ascending: true })
      .limit(5),
    supabase
      .from("payments")
      .select("id,amount,gross_amount,status,paid_at,created_at,invoice_id,payment_method,payment_model,invoices(invoice_number,clients(profiles(first_name,last_name)))")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("tasks").select("id,title,due_date,status").neq("status", "complete").order("due_date", { ascending: true }).limit(5),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("business_settings")
      .select("business_email,inquiry_recipient_email,email_readiness_status,email_provider_last_error,email_last_test_sent_at,email_last_error")
      .limit(1)
      .maybeSingle(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).in("status", ["scheduled", "requested"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client").eq("active", true).is("auth_user_id", null),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("id")
      .lt("due_date", today)
      .gt("balance_due", 0)
      .not("status", "eq", "draft")
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .not("status", "eq", "void"),
    supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const { data: settings } = settingsResult;

  const requestRows = newRequests ?? [];
  const messageRows = messages ?? [];
  const projectRows = projects ?? [];
  const invoiceRows = invoices ?? [];
  const paymentRows = payments ?? [];
  const taskRows = tasks ?? [];
  const emailRecipient = settings?.inquiry_recipient_email ?? settings?.business_email;
  const emailReadinessStatus = mapEmailReadinessStatus(
    settings?.email_readiness_status,
    settings?.email_provider_last_error ?? settings?.email_last_error,
  );

  // OR-style signal across leads + consultations (may overlap when both are open).
  const newConsultationRequestCount = Number(newLeadCount ?? 0) + Number(requestedConsultationCount ?? 0);
  const consultationsAwaitingFollowUp = Number(followUpConsultationCount ?? 0);
  const clientsAwaitingPortal = Number(awaitingPortalCount ?? 0);
  const overdueInvoiceIds = new Set((overdueByDateRows ?? []).map((row) => row.id));
  const overdueInvoices = Math.max(Number(overdueByStatusCount ?? 0), overdueInvoiceIds.size);
  const unreadClientMessages = Number(unreadClientMessageCount ?? 0);

  const ownerActionCount =
    newConsultationRequestCount +
    consultationsAwaitingFollowUp +
    clientsAwaitingPortal +
    overdueInvoices +
    unreadClientMessages;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Owner Operating Dashboard</span>
          <h1>Bridget Pope Designs</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" aria-label="Notifications"><Bell size={17} /></button>
          <ButtonLink href="/admin/proposals/new"><Plus size={16} /> New Proposal</ButtonLink>
        </div>
      </div>

      <div className="dashboard-grid">
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
                  <div className="mini-meta">Submitted {formatTimestamp(lead.created_at)}</div>
                  <div className="mini-meta">{lead.event_type} · {formatDate(lead.event_date)} · {lead.venue || lead.city || "Venue pending"}</div>
                  <div className="mini-meta">{lead.estimated_budget || "Budget pending"} · {(lead.services_needed ?? []).join(", ") || "Services pending"} · {lead.preferred_consultation_method || "Consultation method pending"}</div>
                  <div className="mini-meta">{lead.email} · {lead.phone}</div>
                </div>
                <div className="topbar-actions">
                  <ButtonLink href={`/admin/leads/${lead.id}`} variant="light">Open Request</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=contacted`} variant="secondary">Mark Contacted</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=schedule`} variant="light">Schedule Consultation</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}?action=convert`} variant="light">Convert to Client</ButtonLink>
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
            <li><span>Open owner actions</span><span className="status">{ownerActionCount}</span></li>
            <li><span>New consultation requests</span><span className="status">{newConsultationRequestCount}</span></li>
            <li><span>Consultations awaiting follow-up</span><span className="status">{consultationsAwaitingFollowUp}</span></li>
            <li><span>Clients awaiting portal</span><span className="status">{clientsAwaitingPortal}</span></li>
            <li><span>Overdue invoices</span><span className="status">{overdueInvoices}</span></li>
            <li><span>Unread client messages</span><span className="status">{unreadClientMessages}</span></li>
            <li><span>Unread notifications</span><span className="status">{unreadNotifications ?? 0}</span></li>
            <li><span>Email setup</span><span className="status">{readinessLabel(emailReadinessStatus)}</span></li>
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
                <span>{message.body?.slice(0, 72) || "Message"}<span className="mini-meta">{formatTimestamp(message.created_at)}</span></span>
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
                <span>{project.event_name}<span className="mini-meta">{formatDate(project.event_date)} · {project.venue_name || project.event_type}</span></span>
                <ButtonLink href={`/admin/projects/${project.id}`} variant="light">Open</ButtonLink>
              </li>
            ))}
            {!projectRows.length ? <li>No upcoming events are synced yet.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>Open Invoices</h2>
          <ul className="list">
            {invoiceRows.map((invoice) => (
              <li key={invoice.id}>
                <span>{invoice.invoice_number}<span className="mini-meta">Due {formatDate(invoice.due_date)} · {invoice.status}</span></span>
                <strong>{currency(Number(invoice.balance_due ?? 0))}</strong>
              </li>
            ))}
            {!invoiceRows.length ? <li>No open invoice balances.</li> : null}
          </ul>
        </section>

        <section className="panel span-2">
          <h2>Recent Payments</h2>
          <ul className="list">
            {paymentRows.map((payment) => (
              <li key={payment.id}>
                <span>
                  Payment {currency(Number(payment.gross_amount ?? payment.amount ?? 0))}
                  <span className="mini-meta">
                    {payment.payment_method || "manual"} · {payment.payment_model || "manual"}
                  </span>
                </span>
                <strong>{payment.status}</strong>
              </li>
            ))}
            {!paymentRows.length ? <li>No payment activity yet.</li> : null}
          </ul>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Email Status</h2>
            <MailCheck size={18} />
          </div>
          <ul className="list">
            <li><span>Readiness</span><span className="status">{emailReadinessStatus}</span></li>
            <li><span>Inquiry recipient</span><span className="status">{emailRecipient ?? "Not configured"}</span></li>
            <li><span>Last test</span><span className="status">{settings?.email_last_test_sent_at ? formatTimestamp(settings.email_last_test_sent_at) : "None"}</span></li>
          </ul>
          {settings?.email_provider_last_error || settings?.email_last_error ? <p className="form-error">{settings.email_provider_last_error ?? settings.email_last_error}</p> : null}
          <ButtonLink href="/admin/settings" variant="light">Open Email Settings</ButtonLink>
        </section>

        <section className="panel">
          <h2>Tasks</h2>
          <ul className="list">
            {taskRows.map((task) => (
              <li key={task.id}>
                <span>{task.title}<span className="mini-meta">{task.due_date ? formatDate(task.due_date) : task.status}</span></span>
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

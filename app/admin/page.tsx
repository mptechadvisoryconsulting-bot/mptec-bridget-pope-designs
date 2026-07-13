import { Bell, CalendarDays, MailCheck, MessageSquare, Plus } from "lucide-react";
import { PaymentSetupCard } from "@/components/admin/PaymentSetupCard";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeReadinessStatus } from "@/lib/stripe/connect";

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
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();
  const [
    { data: newRequests },
    { data: messages },
    { data: projects },
    { data: invoices },
    { data: payments },
    { data: tasks },
    { count: unreadNotifications },
    { data: settings },
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
      .select("id,event_name,event_type,event_date,venue,status")
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(5),
    supabase
      .from("invoices")
      .select("id,invoice_number,total,amount_paid,balance_due,due_date,status,clients(profiles(first_name,last_name))")
      .gt("balance_due", 0)
      .order("due_date", { ascending: true })
      .limit(5),
    supabase
      .from("payments")
      .select("id,amount,gross_amount,platform_fee_amount,stripe_processing_fee,net_amount,status,paid_at,created_at,invoice_id,invoices(invoice_number,clients(profiles(first_name,last_name)))")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("tasks").select("id,title,due_date,status").neq("status", "complete").order("due_date", { ascending: true }).limit(5),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("business_settings")
      .select("business_email,inquiry_recipient_email,stripe_connected_account_id,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted,stripe_requirements_currently_due,stripe_requirements_disabled_reason,stripe_account_last_synced_at,email_readiness_status,email_provider_last_error,email_last_test_sent_at,email_last_error,payment_readiness_status,platform_fee_basis_points")
      .limit(1)
      .maybeSingle(),
  ]);

  const requestRows = newRequests ?? [];
  const messageRows = messages ?? [];
  const projectRows = projects ?? [];
  const invoiceRows = invoices ?? [];
  const paymentRows = payments ?? [];
  const taskRows = tasks ?? [];
  const paymentStatus = stripeReadinessStatus(settings);
  const accountId = settings?.stripe_connected_account_id ? `****${settings.stripe_connected_account_id.slice(-4)}` : null;
  const emailRecipient = settings?.inquiry_recipient_email ?? settings?.business_email;
  const emailReady = Boolean(emailRecipient && settings?.email_readiness_status !== "failed" && !settings?.email_provider_last_error);
  const ownerActionCount =
    requestRows.length +
    invoiceRows.length +
    Number(unreadNotifications ?? 0) +
    (paymentStatus === "ready" ? 0 : 1) +
    (emailReady ? 0 : 1);

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
                  <ButtonLink href={`/admin/leads/${lead.id}`} variant="secondary">Mark Contacted</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}`} variant="light">Schedule Consultation</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}`} variant="light">Convert to Client</ButtonLink>
                  <ButtonLink href={`/admin/leads/${lead.id}`} variant="light">Archive</ButtonLink>
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
            <li><span>Unread notifications</span><span className="status">{unreadNotifications ?? 0}</span></li>
            <li><span>Stripe setup</span><span className="status">{paymentStatus.replace(/_/g, " ")}</span></li>
            <li><span>Email setup</span><span className="status">{emailReady ? "ready" : "needs setup"}</span></li>
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
                <span>{project.event_name}<span className="mini-meta">{formatDate(project.event_date)} · {project.venue || project.event_type}</span></span>
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
                  Customer Payment {currency(Number(payment.gross_amount ?? payment.amount ?? 0))}
                  <span className="mini-meta">
                    Platform Fee {currency(Number(payment.platform_fee_amount ?? 0))} · Stripe Fee {payment.stripe_processing_fee == null ? "pending" : currency(Number(payment.stripe_processing_fee))} · Net {payment.net_amount == null ? "pending" : currency(Number(payment.net_amount))}
                  </span>
                </span>
                <strong>{payment.status}</strong>
              </li>
            ))}
            {!paymentRows.length ? <li>No payment activity yet.</li> : null}
          </ul>
        </section>

        <PaymentSetupCard
          accountLastSyncedAt={settings?.stripe_account_last_synced_at}
          canManage={profile?.role === "owner"}
          chargesEnabled={Boolean(settings?.stripe_charges_enabled)}
          connectedAccountId={accountId}
          detailsSubmitted={Boolean(settings?.stripe_details_submitted)}
          paymentReadinessStatus={paymentStatus}
          payoutsEnabled={Boolean(settings?.stripe_payouts_enabled)}
          platformFeeBasisPoints={Number(settings?.platform_fee_basis_points ?? 100)}
          requirementsCurrentlyDue={settings?.stripe_requirements_currently_due ?? []}
          requirementsDisabledReason={settings?.stripe_requirements_disabled_reason}
        />

        <section className="panel">
          <div className="section-heading">
            <h2>Email Status</h2>
            <MailCheck size={18} />
          </div>
          <ul className="list">
            <li><span>Readiness</span><span className="status">{emailReady ? "READY" : "NOT_CONFIGURED"}</span></li>
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

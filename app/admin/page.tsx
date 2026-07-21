import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/dates";
import { first } from "@/lib/supabase/relations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const FOLLOW_UP_STATUSES = ["contacted", "consultation_scheduled"] as const;
const QUEUE_LIMIT = 5;

type ProfileRef = { first_name?: string | null; last_name?: string | null };
type ClientRef = { bpd_profiles?: ProfileRef | ProfileRef[] | null };
type ProjectRef = { event_name?: string | null; bpd_clients?: ClientRef | ClientRef[] | null };
type ConversationRef = {
  id?: string | null;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
};

function personName(profile?: ProfileRef | null) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";
}

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const [
    { count: newInquiryCount },
    { data: newInquiries },
    { count: followUpCount },
    { data: followUps },
    { count: unpaidCount },
    { data: unpaidInvoices },
    { count: unreadCount },
    { data: unreadMessages },
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("leads")
      .select("id,first_name,last_name,event_type,event_date,venue,city,created_at,status")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(QUEUE_LIMIT),
    supabase.from("leads").select("id", { count: "exact", head: true }).in("status", [...FOLLOW_UP_STATUSES]),
    supabase
      .from("leads")
      .select("id,first_name,last_name,event_type,event_date,status,updated_at")
      .in("status", [...FOLLOW_UP_STATUSES])
      .order("updated_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    supabase.from("invoices").select("id", { count: "exact", head: true }).gt("balance_due", 0).not("status", "eq", "draft"),
    supabase
      .from("invoices")
      .select("id,invoice_number,balance_due,due_date,status,bpd_clients!client_id(bpd_profiles(first_name,last_name))")
      .gt("balance_due", 0)
      .not("status", "eq", "draft")
      .order("due_date", { ascending: true })
      .limit(QUEUE_LIMIT),
    supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .from("messages")
      .select(
        "id,body,created_at,conversation_id,bpd_conversations(id,bpd_projects!project_id(event_name,bpd_clients!client_id(bpd_profiles(first_name,last_name))))",
      )
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(QUEUE_LIMIT),
  ]);

  const inquiryRows = newInquiries ?? [];
  const followUpRows = followUps ?? [];
  const invoiceRows = unpaidInvoices ?? [];
  const messageRows = unreadMessages ?? [];

  const summaryCards = [
    {
      label: "New inquiries",
      value: newInquiryCount ?? 0,
      note: "Consultation requests",
      href: "/admin/leads?status=new",
    },
    {
      label: "Needs follow-up",
      value: followUpCount ?? 0,
      note: "Contacted or scheduled",
      href: "/admin/leads?status=follow_up",
    },
    {
      label: "Unpaid invoices",
      value: unpaidCount ?? 0,
      note: "Balances still due",
      href: "/admin/invoices?status=unpaid",
    },
    {
      label: "Unread messages",
      value: unreadCount ?? 0,
      note: "Client conversations",
      href: "/admin/messages",
    },
  ].filter((card) => card.value > 0);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Action center</span>
          <h1>Today</h1>
          <p className="mini-meta">What needs attention — inquiries, follow-ups, invoices, and messages.</p>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/today" variant="secondary">
            Today board
          </ButtonLink>
          <ButtonLink href="/admin/leads?status=new">Review leads</ButtonLink>
        </div>
      </div>

      {summaryCards.length ? (
        <section className="stats-grid action-summary-grid" aria-label="Action summary">
          {summaryCards.map((card) => (
            <Link className="stat-card stat-card-link" href={card.href} key={card.label} prefetch={false}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>All clear</h2>
          <p className="mini-meta" style={{ margin: 0 }}>
            No new inquiries, follow-ups, unpaid invoices, or unread messages.
          </p>
        </section>
      )}

      <div className="dashboard-grid today-queues">
        {inquiryRows.length ? (
          <section className="panel">
            <div className="section-heading">
              <h2>New inquiries</h2>
              <Link className="mini-meta" href="/admin/leads?status=new" prefetch={false}>
                View all
              </Link>
            </div>
            <ul className="list">
              {inquiryRows.map((lead) => (
                <li key={lead.id}>
                  <Link className="queue-row" href={`/admin/leads/${lead.id}`} prefetch={false}>
                    <span>
                      <strong>
                        {lead.first_name} {lead.last_name}
                      </strong>
                      <span className="mini-meta">
                        {lead.event_type} · {formatDate(lead.event_date, "Date pending")} ·{" "}
                        {lead.venue || lead.city || "Venue pending"}
                      </span>
                      <span className="mini-meta">Submitted {formatDateTime(lead.created_at)}</span>
                    </span>
                    <StatusBadge status={lead.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {followUpRows.length ? (
          <section className="panel">
            <div className="section-heading">
              <h2>Needs follow-up</h2>
              <Link className="mini-meta" href="/admin/leads?status=follow_up" prefetch={false}>
                View all
              </Link>
            </div>
            <ul className="list">
              {followUpRows.map((lead) => (
                <li key={lead.id}>
                  <Link className="queue-row" href={`/admin/leads/${lead.id}`} prefetch={false}>
                    <span>
                      <strong>
                        {lead.first_name} {lead.last_name}
                      </strong>
                      <span className="mini-meta">
                        {lead.event_type} · {formatDate(lead.event_date, "Date pending")} · Updated{" "}
                        {formatDateTime(lead.updated_at)}
                      </span>
                    </span>
                    <StatusBadge status={lead.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {invoiceRows.length ? (
          <section className="panel">
            <div className="section-heading">
              <h2>Unpaid invoices</h2>
              <Link className="mini-meta" href="/admin/invoices?status=unpaid" prefetch={false}>
                View all
              </Link>
            </div>
            <ul className="list">
              {invoiceRows.map((invoice) => {
                const client = first(invoice.bpd_clients as ClientRef | ClientRef[] | null);
                const profile = first(client?.bpd_profiles);
                return (
                  <li key={invoice.id}>
                    <Link className="queue-row" href={`/admin/invoices/${invoice.id}`} prefetch={false}>
                      <span>
                        <strong>{invoice.invoice_number}</strong>
                        <span className="mini-meta">
                          {personName(profile)} · Due {formatDate(invoice.due_date, "n/a")}
                        </span>
                      </span>
                      <strong>{currency(Number(invoice.balance_due ?? 0))}</strong>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {messageRows.length ? (
          <section className="panel">
            <div className="section-heading">
              <h2>Unread messages</h2>
              <Link className="mini-meta" href="/admin/messages" prefetch={false}>
                View all
              </Link>
            </div>
            <ul className="list">
              {messageRows.map((message) => {
                const conversation = first(
                  (message as { bpd_conversations?: ConversationRef | ConversationRef[] | null }).bpd_conversations,
                );
                const project = first(conversation?.bpd_projects);
                const client = first(project?.bpd_clients);
                const profile = first(client?.bpd_profiles);
                const conversationId = message.conversation_id || conversation?.id;
                return (
                  <li key={message.id}>
                    <Link
                      className="queue-row"
                      href={conversationId ? `/admin/messages?conversation=${conversationId}` : "/admin/messages"}
                      prefetch={false}
                    >
                      <span>
                        <strong>{personName(profile)}</strong>
                        <span className="mini-meta">
                          {project?.event_name || "Conversation"} · {formatDateTime(message.created_at)}
                        </span>
                        <span className="mini-meta">{message.body?.slice(0, 72) || "Message"}</span>
                      </span>
                      <StatusBadge status="unread" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

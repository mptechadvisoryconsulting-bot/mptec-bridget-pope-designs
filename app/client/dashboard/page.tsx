import { Checklist } from "@/components/client/Checklist";
import { EventProgress } from "@/components/client/EventProgress";
import { PaymentCard } from "@/components/client/PaymentCard";
import { applyClientInvoiceVisibilityFilter } from "@/lib/invoices/client-visibility";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ project?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const context = await requireClientPortalContext("/client/dashboard", { projectId: params.project });
  const { profile, project, projects } = context;
  const admin = createAdminClient();

  const invoiceQuery = project?.id
    ? applyClientInvoiceVisibilityFilter(
        admin
          .from("invoices")
          .select("id,balance_due,due_date,status,invoice_number")
          .eq("project_id", project.id)
          .order("due_date", { ascending: true })
          .limit(5),
      )
    : null;

  const [{ data: invoices }, { data: milestones }, { data: conversation }, { data: files }, { data: designUpdates }, { data: meetings }] =
    await Promise.all([
      invoiceQuery ? invoiceQuery : Promise.resolve({ data: [] as Array<{ id: string; balance_due: number; due_date?: string | null; status: string; invoice_number: string }> }),
      project?.id
        ? admin
            .from("milestones")
            .select("title,due_date,status,completed_at")
            .eq("project_id", project.id)
            .eq("client_visible", true)
            .order("sort_order", { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [] }),
      project?.id
        ? admin.from("conversations").select("id").eq("project_id", project.id).maybeSingle()
        : Promise.resolve({ data: null }),
      project?.id
        ? admin
            .from("files")
            .select("id,file_name,created_at")
            .eq("project_id", project.id)
            .eq("visibility", "client_visible")
            .order("created_at", { ascending: false })
            .limit(3)
        : Promise.resolve({ data: [] }),
      project?.id
        ? admin
            .from("design_updates")
            .select("id,title,status,created_at")
            .eq("project_id", project.id)
            .eq("client_visible", true)
            .order("created_at", { ascending: false })
            .limit(3)
        : Promise.resolve({ data: [] }),
      project?.id
        ? admin
            .from("calendar_events")
            .select("id,title,starts_at,event_type")
            .eq("project_id", project.id)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(2)
        : Promise.resolve({ data: [] }),
    ]);

  const { count: unreadCount } = conversation?.id
    ? await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", profile.id)
        .is("read_at", null)
    : { count: 0 };

  const invoiceRows = invoices ?? [];
  const openInvoice =
    invoiceRows.find((row) => row.status !== "paid" && row.status !== "cancelled" && row.status !== "draft") ?? null;
  const clientName = profile.first_name ?? "Client";
  const eventName = project?.event_name ?? "Your Event";
  const eventDate = project?.event_date ?? "Date pending";
  const venue = [project?.venue_name, project?.city].filter(Boolean).join(" · ") || "Venue pending";
  const status = project?.status?.replace(/_/g, " ") ?? "setup pending";
  const checklistItems = (milestones ?? [])
    .filter((item) => !(Boolean(item.completed_at) || item.status === "complete"))
    .slice(0, 4)
    .map((item) => ({
      label: item.title,
      done: false,
    }));
  const latestDesign = (designUpdates ?? [])[0] ?? null;
  const nextMeeting = (meetings ?? [])[0] ?? null;

  return (
    <div>
      <section className="client-hero">
        <div>
          <h1>Welcome, {clientName}</h1>
          <p className="mini-meta">Your next steps for {eventName} — payments, designs, and messages.</p>
          {projects.length > 1 ? (
            <p className="mini-meta" style={{ marginTop: 8 }}>
              Projects:{" "}
              {projects.map((item, index) => (
                <span key={item.id}>
                  {index > 0 ? " · " : null}
                  <a href={`/client/dashboard?project=${item.id}`}>{item.event_name}</a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <article className="card event-summary">
          <div>
            <span className="mini-meta">My Event</span>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 22 }}>{eventName}</strong>
            <p className="mini-meta">{eventDate} · {venue}</p>
            <p><span className="status">{status}</span></p>
            <a className="panel-link" href="/client/event">View event details</a>
          </div>
          <img src="/images/client-event.png" alt="Client event preview" />
        </article>
      </section>

      <EventProgress status={project?.status ?? "pending"} />

      <div className="client-focus-grid section-focus">
        <PaymentCard
          balanceDue={Number(openInvoice?.balance_due ?? 0)}
          dueDate={openInvoice?.due_date}
          status={openInvoice?.status}
          invoiceId={openInvoice?.id}
        />

        <section className="panel">
          <h2>Next up</h2>
          <ul className="list">
            {latestDesign ? (
              <li>
                <span>
                  Design update
                  <span className="mini-meta">{latestDesign.title}</span>
                </span>
                <span className="status">{latestDesign.status}</span>
              </li>
            ) : null}
            {nextMeeting ? (
              <li>
                <span>
                  Upcoming meeting
                  <span className="mini-meta">{nextMeeting.title} · {formatDateTime(nextMeeting.starts_at)}</span>
                </span>
              </li>
            ) : null}
            {(files ?? [])[0] ? (
              <li>
                <span>
                  Latest file
                  <span className="mini-meta">{(files ?? [])[0].file_name}</span>
                </span>
              </li>
            ) : null}
            {Number(unreadCount ?? 0) > 0 ? (
              <li>
                <span>
                  Unread messages
                  <span className="mini-meta">{unreadCount} waiting</span>
                </span>
                <a className="panel-link" href="/client/messages">Open</a>
              </li>
            ) : null}
            {!latestDesign && !nextMeeting && !(files ?? []).length && !unreadCount ? (
              <li>Your designer will share updates here as planning moves forward.</li>
            ) : null}
          </ul>
          <div className="topbar-actions" style={{ marginTop: 12 }}>
            <a className="panel-link" href="/client/designs">Designs</a>
            <a className="panel-link" href="/client/documents">Documents</a>
            <a className="panel-link" href="/client/messages">Messages</a>
          </div>
        </section>
      </div>

      {checklistItems.length ? (
        <div className="client-focus-grid" style={{ marginTop: 16 }}>
          <Checklist items={checklistItems} />
          <section className="panel">
            <h2>Open invoices</h2>
            <ul className="list">
              {invoiceRows.slice(0, 3).map((invoice) => (
                <li key={invoice.id}>
                  <span>
                    <a href={`/client/invoices/${invoice.id}`}>{invoice.invoice_number}</a>
                    <span className="mini-meta">{formatDate(invoice.due_date, "No due date")}</span>
                  </span>
                  <span className="status">{invoice.status}</span>
                </li>
              ))}
              {!invoiceRows.length ? <li>No invoices to review.</li> : null}
            </ul>
            <a className="panel-link" href="/client/payments">Payments & invoices</a>
          </section>
        </div>
      ) : (
        <div className="client-focus-grid" style={{ marginTop: 16 }}>
          <section className="panel">
            <h2>Open invoices</h2>
            <ul className="list">
              {invoiceRows.slice(0, 3).map((invoice) => (
                <li key={invoice.id}>
                  <span>
                    <a href={`/client/invoices/${invoice.id}`}>{invoice.invoice_number}</a>
                    <span className="mini-meta">{formatDate(invoice.due_date, "No due date")}</span>
                  </span>
                  <span className="status">{invoice.status}</span>
                </li>
              ))}
              {!invoiceRows.length ? <li>No invoices to review.</li> : null}
            </ul>
            <a className="panel-link" href="/client/payments">Payments & invoices</a>
          </section>
        </div>
      )}
    </div>
  );
}

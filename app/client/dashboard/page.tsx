import { CalendarDays, FileSignature, FolderOpen, MessageSquare, Palette, ReceiptText } from "lucide-react";
import { Checklist } from "@/components/client/Checklist";
import { EventProgress } from "@/components/client/EventProgress";
import { MessagePanel } from "@/components/client/MessagePanel";
import { PaymentCard } from "@/components/client/PaymentCard";
import { Timeline } from "@/components/client/Timeline";
import { ButtonLink } from "@/components/ui/button";
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

  const [{ data: invoices }, { data: milestones }, { data: conversation }, { data: files }, { data: designUpdates }, { data: meetings }, { data: activity }] =
    await Promise.all([
      invoiceQuery ? invoiceQuery : Promise.resolve({ data: [] as Array<{ id: string; balance_due: number; due_date?: string | null; status: string; invoice_number: string }> }),
      project?.id
        ? admin
            .from("milestones")
            .select("title,due_date,status,completed_at")
            .eq("project_id", project.id)
            .eq("client_visible", true)
            .order("sort_order", { ascending: true })
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
            .limit(5)
        : Promise.resolve({ data: [] }),
      project?.id
        ? admin
            .from("design_updates")
            .select("id,title,status,created_at")
            .eq("project_id", project.id)
            .eq("client_visible", true)
            .order("created_at", { ascending: false })
            .limit(4)
        : Promise.resolve({ data: [] }),
      project?.id
        ? admin
            .from("calendar_events")
            .select("id,title,starts_at,event_type")
            .eq("project_id", project.id)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(4)
        : Promise.resolve({ data: [] }),
      project?.id
        ? admin
            .from("activity_logs")
            .select("id,action,created_at")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
    ]);

  const { data: messages } = conversation?.id
    ? await admin
        .from("messages")
        .select("id,body,sender_id,created_at,read_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(10)
    : { data: [] };

  const invoiceRows = invoices ?? [];
  const openInvoice =
    invoiceRows.find((row) => row.status !== "paid" && row.status !== "cancelled" && row.status !== "draft") ?? null;
  const clientName = profile.first_name ?? "Client";
  const eventName = project?.event_name ?? "Your Event";
  const eventDate = project?.event_date ?? "Date pending";
  const venue = [project?.venue_name, project?.city].filter(Boolean).join(" · ") || "Venue pending";
  const status = project?.status?.replace(/_/g, " ") ?? "setup pending";
  const milestoneItems = (milestones ?? []).map((item) => ({
    title: item.title,
    date: item.due_date ?? "No date set",
    status: item.status,
  }));
  const checklistItems = (milestones ?? []).map((item) => ({
    label: item.title,
    done: Boolean(item.completed_at) || item.status === "complete",
  }));

  return (
    <div>
      <section className="client-hero">
        <div>
          <h1>Welcome, {clientName}</h1>
          <p className="mini-meta">Your project progress, invoices, files, and messages in one place.</p>
        </div>
        <article className="card event-summary">
          <div>
            <span className="mini-meta">Your Event</span>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 22 }}>{eventName}</strong>
            <p className="mini-meta">{eventDate} · {venue}</p>
            <p><span className="status">{status}</span></p>
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
            <ButtonLink href="/client/event" variant="light">View Event Details</ButtonLink>
          </div>
          <img src="/images/client-event.png" alt="Client event preview" />
        </article>
      </section>

      <EventProgress status={project?.status ?? "pending"} />

      <div className="client-grid">
        <PaymentCard
          balanceDue={Number(openInvoice?.balance_due ?? 0)}
          dueDate={openInvoice?.due_date}
          status={openInvoice?.status}
          invoiceId={openInvoice?.id}
        />

        <section className="panel">
          <h2>Invoices</h2>
          <ul className="list">
            {invoiceRows.map((invoice) => (
              <li key={invoice.id}>
                <span>
                  <a href={`/client/invoices/${invoice.id}`}>{invoice.invoice_number}</a>
                  <span className="mini-meta">{formatDate(invoice.due_date, "No due date")}</span>
                </span>
                <span className="status">{invoice.status}</span>
              </li>
            ))}
            {!invoiceRows.length ? <li>No invoices to review yet.</li> : null}
          </ul>
          <ButtonLink href="/client/invoices" variant="light"><ReceiptText size={15} /> All Invoices</ButtonLink>
        </section>

        <section className="panel">
          <h2>Files</h2>
          <ul className="list">
            {(files ?? []).map((file) => (
              <li key={file.id}>
                <span>{file.file_name}</span>
                <span className="mini-meta">{formatDateTime(file.created_at)}</span>
              </li>
            ))}
            {!(files ?? []).length ? <li>No shared files yet.</li> : null}
          </ul>
          <ButtonLink href="/client/files" variant="light"><FolderOpen size={15} /> Project Files</ButtonLink>
        </section>

        <section className="panel">
          <h2>Design Updates</h2>
          <ul className="list">
            {(designUpdates ?? []).map((update) => (
              <li key={update.id}>
                <span>{update.title}</span>
                <span className="status">{update.status}</span>
              </li>
            ))}
            {!(designUpdates ?? []).length ? <li>No design updates shared yet.</li> : null}
          </ul>
          <ButtonLink href="/client/designs" variant="light"><Palette size={15} /> View Designs</ButtonLink>
        </section>

        <section className="panel">
          <h2>Upcoming Meetings</h2>
          <ul className="list">
            {(meetings ?? []).map((meeting) => (
              <li key={meeting.id}>
                <span>
                  {meeting.title}
                  <span className="mini-meta">{formatDateTime(meeting.starts_at)}</span>
                </span>
              </li>
            ))}
            {!(meetings ?? []).length ? <li>No upcoming meetings scheduled.</li> : null}
          </ul>
          <ButtonLink href="/client/event" variant="light"><CalendarDays size={15} /> Event Details</ButtonLink>
        </section>

        <section className="panel">
          <h2>Recent Activity</h2>
          <ul className="list">
            {(activity ?? []).map((item) => (
              <li key={item.id}>
                <span>{item.action.replace(/_/g, " ")}</span>
                <span className="mini-meta">{formatDateTime(item.created_at)}</span>
              </li>
            ))}
            {!(activity ?? []).length ? <li>No recent project activity.</li> : null}
          </ul>
          <ButtonLink href="/client/proposals" variant="light"><FileSignature size={15} /> Proposals & Contracts</ButtonLink>
        </section>
      </div>

      <div className="client-grid" style={{ marginTop: 16 }}>
        <Timeline items={milestoneItems} />
        <Checklist items={checklistItems} />
        <section className="panel">
          <h2>Messages</h2>
          {conversation?.id ? (
            <MessagePanel
              conversationId={conversation.id}
              messages={(messages ?? []).map((message) => ({
                id: message.id,
                body: message.body,
                fromAdmin: message.sender_id !== profile.id,
                readAt: message.read_at,
              }))}
            />
          ) : (
            <p className="mini-meta">Messaging will appear once your project conversation is ready.</p>
          )}
          <ButtonLink href="/client/messages" variant="light"><MessageSquare size={15} /> Open Messages</ButtonLink>
        </section>
      </div>
    </div>
  );
}

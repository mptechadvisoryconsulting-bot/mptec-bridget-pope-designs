import { CalendarDays, ExternalLink, MessageSquare, Palette, Share2, Sparkles } from "lucide-react";
import { Checklist } from "@/components/client/Checklist";
import { EventProgress } from "@/components/client/EventProgress";
import { MessagePanel } from "@/components/client/MessagePanel";
import { Timeline } from "@/components/client/Timeline";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { latestHoneyBookReference, loadProjectHoneyBookReferences } from "@/lib/honeybook/references";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

const quickActions = [
  { label: "View Designs", href: "/client/designs", icon: Palette },
  { label: "Share Inspiration", href: "/client/inspiration", icon: Share2 },
  { label: "Event Timeline", href: "/client/timeline", icon: CalendarDays },
  { label: "Message Bridget", href: "/client/messages", icon: MessageSquare },
  { label: "HoneyBook", href: "/client/honeybook", icon: ExternalLink },
];

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

  const [{ data: milestones }, { data: conversation }, honeybookReferences, { data: designActions }] = await Promise.all([
    project?.id
      ? admin
          .from("milestones")
          .select("title,due_date,status,completed_at")
          .eq("project_id", project.id)
          .eq("client_visible", true)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    project?.id ? admin.from("conversations").select("id").eq("project_id", project.id).maybeSingle() : Promise.resolve({ data: null }),
    project?.id ? loadProjectHoneyBookReferences(admin, project.id) : Promise.resolve([]),
    project?.id
      ? admin
          .from("design_updates")
          .select("id,title,client_action_status,client_action_type")
          .eq("project_id", project.id)
          .eq("client_visible", true)
          .eq("requires_client_action", true)
          .in("client_action_status", ["pending", "overdue"])
          .order("created_at", { ascending: false })
          .limit(1)
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

  const latestHoneyBook = latestHoneyBookReference(honeybookReferences);
  const latestAction = designActions?.[0] ?? null;
  const clientName = profile.first_name ?? "Client";
  const eventName = project?.event_name ?? "Your Event";
  const eventDate = project?.event_date ?? "Date pending";
  const venue = [project?.venue_name, project?.city].filter(Boolean).join(" - ") || "Venue pending";
  const status = project?.status?.replace(/_/g, " ") ?? "setup pending";

  return (
    <div>
      <section className="client-hero">
        <div>
          <h1>Welcome, {clientName}!</h1>
          <p className="mini-meta">Your project workspace for designs, messages, files, and event details.</p>
        </div>
        <article className="card event-summary">
          <div>
            <span className="mini-meta">Your Event</span>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 22 }}>{eventName}</strong>
            <p className="mini-meta">{eventDate} - {venue}</p>
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
        <section className="panel">
          <h2>HoneyBook Status</h2>
          <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 24, margin: "20px 0 6px" }}>
            {latestHoneyBook?.invoice_status ?? "Reference Pending"}
          </strong>
          <p className="mini-meta">
            {latestHoneyBook?.balance_remaining != null
              ? `Balance reference: ${currency(Number(latestHoneyBook.balance_remaining))}`
              : "Financial documents and payments are handled in HoneyBook."}
          </p>
          {latestHoneyBook?.honeybook_url ? (
            <a className="btn btn-primary" href={latestHoneyBook.honeybook_url} rel="noreferrer" target="_blank">
              <ExternalLink size={16} /> View in HoneyBook
            </a>
          ) : (
            <ButtonLink href="/client/honeybook">View HoneyBook Reference</ButtonLink>
          )}
        </section>

        <section className="panel">
          <h2>Client Action Required</h2>
          <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 24, margin: "20px 0 6px" }}>
            {latestAction ? "Bridget needs your feedback" : "No action needed"}
          </strong>
          <p className="mini-meta">{latestAction?.title ?? "You are all caught up for now."}</p>
          <ButtonLink href="/client/designs" variant="light">View Designs</ButtonLink>
        </section>

        <section className="panel">
          <h2>Your Planner</h2>
          <Sparkles color="var(--gold)" size={30} />
          <p>Bridget Pope Designs</p>
          <ButtonLink href="/client/messages">Send Message</ButtonLink>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Quick Links</h2>
        <div className="quick-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <a className="quick-action" href={action.href} key={action.href}>
                <Icon size={22} />
                <span>{action.label}</span>
              </a>
            );
          })}
        </div>
      </section>

      <div className="client-grid">
        <Timeline
          items={(milestones ?? []).map((item) => ({
            title: item.title,
            date: item.due_date ?? "No date set",
            status: item.status,
          }))}
        />
        <Checklist
          items={(milestones ?? []).map((item) => ({
            label: item.title,
            done: Boolean(item.completed_at) || item.status === "complete",
          }))}
        />
        <MessagePanel
          conversationId={conversation?.id}
          messages={(messages ?? []).map((message) => ({
            id: message.id,
            body: message.body,
            fromAdmin: message.sender_id !== profile.id,
            readAt: message.read_at,
          }))}
        />
      </div>
    </div>
  );
}

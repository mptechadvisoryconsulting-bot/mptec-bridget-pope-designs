import { CalendarDays, FileSignature, MessageSquare, ReceiptText, Share2, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { Checklist } from "@/components/client/Checklist";
import { EventProgress } from "@/components/client/EventProgress";
import { MessagePanel } from "@/components/client/MessagePanel";
import { Timeline } from "@/components/client/Timeline";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const quickActions = [
  { label: "View Proposals", href: "/client/proposals", icon: FileSignature },
  { label: "Contracts", href: "/client/contracts", icon: FileSignature },
  { label: "Invoices & Receipts", href: "/client/invoices", icon: ReceiptText },
  { label: "Share Inspiration", href: "/client/inspiration", icon: Share2 },
  { label: "Event Timeline", href: "/client/timeline", icon: CalendarDays },
  { label: "Message Planner", href: "/client/messages", icon: MessageSquare },
];

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/client/dashboard");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,first_name,last_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: client } = profile?.id
    ? await admin.from("clients").select("id").eq("profile_id", profile.id).maybeSingle()
    : { data: null };

  const { data: project } = client?.id
    ? await admin
        .from("projects")
        .select("id,event_name,event_type,event_date,venue_name,city,status")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: invoice } = project?.id
    ? await admin
        .from("invoices")
        .select("id,balance_due,due_date,status")
        .eq("project_id", project.id)
        .neq("status", "paid")
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: milestones } = project?.id
    ? await admin
        .from("milestones")
        .select("title,due_date,status,completed_at")
        .eq("project_id", project.id)
        .eq("client_visible", true)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const { data: conversation } = project?.id
    ? await admin.from("conversations").select("id").eq("project_id", project.id).maybeSingle()
    : { data: null };
  const { data: messages } = conversation?.id
    ? await admin
        .from("messages")
        .select("id,body,sender_id,created_at,read_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(10)
    : { data: [] };

  const clientName = profile?.first_name ?? "Client";
  const eventName = project?.event_name ?? "Your Event";
  const eventDate = project?.event_date ?? "Date pending";
  const venue = [project?.venue_name, project?.city].filter(Boolean).join(" - ") || "Venue pending";
  const status = project?.status?.replace(/_/g, " ") ?? "setup pending";

  return (
    <div>
      <section className="client-hero">
        <div>
          <h1>Welcome, {clientName}!</h1>
          <p className="mini-meta">Here is everything about your event in one place.</p>
        </div>
        <article className="card event-summary">
          <div>
            <span className="mini-meta">Your Event</span>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 22 }}>{eventName}</strong>
            <p className="mini-meta">{eventDate} - {venue}</p>
            <p><span className="status">{status}</span></p>
            <ButtonLink href="/client/event" variant="light">View Event Details</ButtonLink>
          </div>
          <img src="/images/client-event.png" alt="Client event preview" />
        </article>
      </section>
      <EventProgress status={project?.status ?? "pending"} />
      <div className="client-grid">
        <section className="panel">
          <h2>Next Payment</h2>
          <span className="mini-meta">Balance Due</span>
          <strong style={{ display: "block", fontSize: 28, margin: "6px 0" }}>
            {invoice ? currency(Number(invoice.balance_due ?? 0)) : "$0"}
          </strong>
          <p className="mini-meta">Due by {invoice?.due_date ?? "No open invoice"}</p>
          <ButtonLink href={invoice?.id ? `/client/invoices/${invoice.id}` : "/client/payments"}>Make Payment</ButtonLink>
          <p className="mini-meta" style={{ marginBottom: 0, marginTop: 10 }}>Secured by Stripe</p>
        </section>
        <section className="panel">
          <h2>Upcoming Milestone</h2>
          <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 24, margin: "20px 0 6px" }}>
            {project ? "Project Status Review" : "Portal Setup"}
          </strong>
          <p className="mini-meta">{status}</p>
          <ButtonLink href="/client/timeline" variant="light">View Timeline</ButtonLink>
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
            fromAdmin: message.sender_id !== profile?.id,
            readAt: message.read_at,
          }))}
        />
      </div>
    </div>
  );
}

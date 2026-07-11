import { CalendarDays, FileSignature, MessageSquare, ReceiptText, Share2, Sparkles } from "lucide-react";
import { Checklist } from "@/components/client/Checklist";
import { EventProgress } from "@/components/client/EventProgress";
import { MessagePanel } from "@/components/client/MessagePanel";
import { PaymentCard } from "@/components/client/PaymentCard";
import { Timeline } from "@/components/client/Timeline";
import { ButtonLink } from "@/components/ui/button";

const quickActions = [
  { label: "View Proposal", href: "/client/proposals/proposal-1001", icon: FileSignature },
  { label: "Contract Signed", href: "/client/contracts/contract-1001", icon: FileSignature },
  { label: "Invoices & Receipts", href: "/client/payments", icon: ReceiptText },
  { label: "Share Inspiration", href: "/client/inspiration", icon: Share2 },
  { label: "Event Timeline", href: "/client/timeline", icon: CalendarDays },
  { label: "Message Planner", href: "/client/messages", icon: MessageSquare },
];

export default function ClientDashboardPage() {
  return (
    <div>
      <section className="client-hero">
        <div>
          <h1>Welcome, Ashley!</h1>
          <p className="mini-meta">Here is everything about your event in one place.</p>
        </div>
        <article className="card event-summary">
          <div>
            <span className="mini-meta">Your Event</span>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 22 }}>Elegant Garden Wedding</strong>
            <p className="mini-meta">June 14, 2025 - Murfreesboro, TN</p>
            <ButtonLink href="/client/event" variant="light">View Event Details</ButtonLink>
          </div>
          <img src="/images/client-event.png" alt="Client event preview" />
        </article>
      </section>
      <EventProgress />
      <div className="client-grid">
        <PaymentCard />
        <section className="panel">
          <h2>Upcoming Milestone</h2>
          <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 24, margin: "20px 0 6px" }}>Final Design Review</strong>
          <p className="mini-meta">May 10, 2025</p>
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
        <Timeline />
        <Checklist />
        <MessagePanel />
      </div>
    </div>
  );
}

import { requireClientPortalContext } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  const { project } = await requireClientPortalContext("/client/event");

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">My Event</span>
          <h1>{project?.event_name ?? "My Event"}</h1>
          <p className="mini-meta">Details sync from the admin project workspace.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Event Details</h2>
        <ul className="list">
          <li><span>Event Type</span><strong>{project?.event_type ?? "Not set"}</strong></li>
          <li><span>Date</span><strong>{project?.event_date ?? "Not set"}</strong></li>
          <li><span>Venue</span><strong>{project?.venue_name ?? "Not set"}</strong></li>
          <li><span>City</span><strong>{project?.city ?? "Not set"}</strong></li>
          <li><span>Status</span><span className="status">{project?.status?.replace(/_/g, " ") ?? "setup pending"}</span></li>
        </ul>
      </section>
    </div>
  );
}

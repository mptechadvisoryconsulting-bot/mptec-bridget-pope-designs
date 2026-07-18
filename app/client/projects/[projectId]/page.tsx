import { notFound } from "next/navigation";
import { Timeline } from "@/components/client/Timeline";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { profile, client } = await requireClientPortalContext(`/client/projects/${projectId}`);
  if (!client?.id) notFound();

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id,client_id,event_name,event_type,event_date,venue_name,city,status,budget")
    .eq("id", projectId)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!project) notFound();

  const { data: milestones } = await supabase
    .from("milestones")
    .select("title,due_date,status,completed_at")
    .eq("project_id", project.id)
    .eq("client_visible", true)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Project Workspace</span>
          <h1>{project.event_name}</h1>
          <p className="mini-meta">{profile.first_name ?? "Client"} can only view this project because it is attached to their client account.</p>
        </div>
      </div>
      <div className="client-grid">
        <section className="panel">
          <h2>Event Details</h2>
          <ul className="list">
            <li><span>Type</span><span>{project.event_type ?? "Not set"}</span></li>
            <li><span>Date</span><span>{project.event_date ?? "Not set"}</span></li>
            <li><span>Venue</span><span>{[project.venue_name, project.city].filter(Boolean).join(" - ") || "Not set"}</span></li>
            <li><span>Status</span><span className="status">{project.status.replace(/_/g, " ")}</span></li>
          </ul>
        </section>
        <Timeline
          items={(milestones ?? []).map((item) => ({
            title: item.title,
            date: item.due_date ?? "No date set",
            status: item.status,
          }))}
        />
      </div>
    </div>
  );
}

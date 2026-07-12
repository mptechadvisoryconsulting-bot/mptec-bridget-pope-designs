import { Timeline } from "@/components/client/Timeline";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const { project } = await requireClientPortalContext("/client/timeline");
  const { data: milestones } = project?.id
    ? await createAdminClient()
        .from("milestones")
        .select("title,due_date,status")
        .eq("project_id", project.id)
        .eq("client_visible", true)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Timeline</span><h1>Planning Timeline</h1></div></div>
      <Timeline
        items={(milestones ?? []).map((item) => ({
          title: item.title,
          date: item.due_date ?? "No date set",
          status: item.status,
        }))}
      />
    </div>
  );
}

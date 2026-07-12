import { Checklist } from "@/components/client/Checklist";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const { project } = await requireClientPortalContext("/client/checklist");
  const { data: milestones } = project?.id
    ? await createAdminClient()
        .from("milestones")
        .select("title,status,completed_at")
        .eq("project_id", project.id)
        .eq("client_visible", true)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Checklist</span><h1>Client Checklist</h1></div></div>
      <Checklist
        items={(milestones ?? []).map((item) => ({
          label: item.title,
          done: Boolean(item.completed_at) || item.status === "complete",
        }))}
      />
    </div>
  );
}

import { DesignResponseActions } from "@/components/client/DesignResponseActions";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDesignsPage() {
  const { project } = await requireClientPortalContext("/client/designs");
  const { data: updates } = project?.id
    ? await createAdminClient()
        .from("design_updates")
        .select("id,title,description,status,created_at,requires_client_action,client_action_status")
        .eq("project_id", project.id)
        .eq("client_visible", true)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Designs</span><h1>Design Updates</h1></div></div>
      <section className="panel">
        <h2>Shared Design Notes</h2>
        <ul className="list">
          {(updates ?? []).map((update) => (
            <li key={update.id}>
              <span>
                <strong>{update.title}</strong><br />
                {update.description ?? ""}
                {update.requires_client_action && update.client_action_status === "pending" ? (
                  <DesignResponseActions updateId={update.id} />
                ) : null}
              </span>
              <span className="status">{update.client_action_status === "pending" ? "feedback needed" : update.status}</span>
            </li>
          ))}
          {!updates?.length ? <li>No design updates have been shared yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

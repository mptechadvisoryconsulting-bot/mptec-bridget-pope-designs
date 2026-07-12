import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function InspirationPage() {
  const { project } = await requireClientPortalContext("/client/inspiration");
  const { data: files } = project?.id
    ? await createAdminClient()
        .from("files")
        .select("id,file_name,storage_path,category,created_at")
        .eq("project_id", project.id)
        .in("visibility", ["client_visible", "client_upload"])
        .or("category.ilike.%inspiration%,category.ilike.%mood%,category.ilike.%design%")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Inspiration</span>
          <h1>Mood Board and Uploads</h1>
          <p className="mini-meta">Inspiration files are shared from the admin workspace and stay connected to this project.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Project Inspiration</h2>
        <div className="gallery-grid">
          {(files ?? []).map((file) => (
            <article className="card" key={file.id}>
              {file.storage_path?.startsWith("http") || file.storage_path?.startsWith("/") ? (
                <img src={file.storage_path} alt={file.file_name} />
              ) : null}
              <h3>{file.file_name}</h3>
              <p className="mini-meta">{file.category ?? "Inspiration"}</p>
            </article>
          ))}
          {!files?.length ? <p className="mini-meta">No inspiration files have been shared yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

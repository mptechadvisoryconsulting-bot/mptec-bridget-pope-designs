import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientFilesPage() {
  const { project } = await requireClientPortalContext("/client/files");
  const { data: files } = project?.id
    ? await createAdminClient()
        .from("files")
        .select("id,file_name,storage_path,category,created_at")
        .eq("project_id", project.id)
        .in("visibility", ["client_visible", "client_upload"])
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Files</span><h1>Project Files</h1></div></div>
      <section className="panel">
        <h2>Shared Files</h2>
        <ul className="list">
          {(files ?? []).map((file) => (
            <li key={file.id}>
              <span>{file.file_name}</span>
              {file.storage_path?.startsWith("http") || file.storage_path?.startsWith("/") ? (
                <a href={file.storage_path}>Open</a>
              ) : (
                <span className="mini-meta">{file.category ?? "File"}</span>
              )}
            </li>
          ))}
          {!files?.length ? <li>No project files have been shared yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

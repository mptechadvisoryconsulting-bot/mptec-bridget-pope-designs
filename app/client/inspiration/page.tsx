import { ProjectFileUploadForm } from "@/components/files/ProjectFileUploadForm";
import { resolveFileUrl } from "@/lib/files/resolve-url";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function InspirationPage() {
  const { project } = await requireClientPortalContext("/client/inspiration");
  const supabase = createAdminClient();
  const { data: files } = project?.id
    ? await supabase
        .from("files")
        .select("id,file_name,storage_path,category,visibility,mime_type,created_at")
        .eq("project_id", project.id)
        .in("visibility", ["client_visible", "client_upload"])
        .or("category.ilike.%inspiration%,category.ilike.%mood%,category.ilike.%design%")
        .order("created_at", { ascending: false })
    : { data: [] };

  const links = await Promise.all((files ?? []).map((file) => resolveFileUrl(supabase, file)));

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Inspiration</span>
          <h1>Mood Board and Uploads</h1>
          <p className="mini-meta">Upload inspiration photos and review files shared with this project.</p>
        </div>
      </div>

      {project?.id ? (
        <ProjectFileUploadForm
          defaultCategory="Inspiration"
          defaultVisibility="client_upload"
          projectId={project.id}
          title="Upload inspiration"
        />
      ) : null}

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Project Inspiration</h2>
        <div className="gallery-grid">
          {(files ?? []).map((file, index) => {
            const url = links[index];
            const isImage = String(file.mime_type ?? "").startsWith("image/");
            return (
              <article className="card" key={file.id}>
                {url && isImage ? <img src={url} alt={file.file_name} /> : null}
                <h3>{file.file_name}</h3>
                <p className="mini-meta">{file.category ?? "Inspiration"}</p>
                {url ? (
                  <a href={url} rel="noreferrer" target="_blank">
                    Open
                  </a>
                ) : null}
              </article>
            );
          })}
          {!files?.length ? <p className="mini-meta">No inspiration files have been shared yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

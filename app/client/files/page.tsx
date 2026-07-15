import { ProjectFileUploadForm } from "@/components/files/ProjectFileUploadForm";
import { resolveFileUrl } from "@/lib/files/resolve-url";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientFilesPage() {
  const { project } = await requireClientPortalContext("/client/files");
  const supabase = createAdminClient();
  const { data: files } = project?.id
    ? await supabase
        .from("files")
        .select("id,file_name,storage_path,category,visibility,mime_type,created_at")
        .eq("project_id", project.id)
        .in("visibility", ["client_visible", "client_upload"])
        .order("created_at", { ascending: false })
    : { data: [] };

  const links = await Promise.all((files ?? []).map((file) => resolveFileUrl(supabase, file)));

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Files</span>
          <h1>Project Files</h1>
        </div>
      </div>

      {project?.id ? (
        <ProjectFileUploadForm
          defaultCategory="Project File"
          defaultVisibility="client_upload"
          projectId={project.id}
          title="Upload a project file"
        />
      ) : null}

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Shared Files</h2>
        <ul className="list">
          {(files ?? []).map((file, index) => (
            <li key={file.id}>
              <span>{file.file_name}</span>
              {links[index] ? (
                <a href={links[index] ?? undefined} rel="noreferrer" target="_blank">
                  Open
                </a>
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

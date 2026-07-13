import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export const dynamic = "force-dynamic";

type ProjectRef = { event_name?: string | null };
type UploaderRef = { first_name?: string | null; last_name?: string | null };

type FileRow = {
  id: string;
  file_name: string;
  category?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  visibility: string;
  storage_path: string;
  created_at: string;
  project_id?: string | null;
  bpd_projects?: ProjectRef | ProjectRef[] | null;
  bpd_profiles?: UploaderRef | UploaderRef[] | null;
};

const visibilityLabels: Record<string, string> = {
  private_admin: "Private (Admin Only)",
  client_visible: "Client Visible",
  client_upload: "Client Upload",
  public_gallery: "Public Gallery",
};

function formatSize(bytes?: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function resolveFileUrl(supabase: ReturnType<typeof createAdminClient>, file: FileRow) {
  if (file.visibility === "public_gallery") {
    const { data } = supabase.storage.from("event-gallery").getPublicUrl(file.storage_path);
    return data.publicUrl;
  }

  const buckets = ["inquiry-pdfs", "event-gallery"];
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return null;
}

export default async function FilesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("files")
    .select("id,file_name,category,mime_type,file_size,visibility,storage_path,created_at,project_id,bpd_projects(event_name),bpd_profiles(first_name,last_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const files = (data ?? []) as FileRow[];
  const links = await Promise.all(files.map((file) => resolveFileUrl(supabase, file)));

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Storage</span>
          <h1>Files</h1>
          <p className="mini-meta">Project files, inquiry PDFs, client uploads, and public-gallery assets.</p>
        </div>
      </div>

      <section className="panel">
        <h2>{files.length} File{files.length === 1 ? "" : "s"}</h2>
        <table className="table">
          <thead>
            <tr><th>File</th><th>Project</th><th>Category</th><th>Visibility</th><th>Size</th><th>Uploaded</th><th /></tr>
          </thead>
          <tbody>
            {files.map((file, index) => {
              const project = first(file.bpd_projects);
              const uploader = first(file.bpd_profiles);
              const uploaderName = [uploader?.first_name, uploader?.last_name].filter(Boolean).join(" ");
              const link = links[index];

              return (
                <tr key={file.id}>
                  <td>{file.file_name}<div className="mini-meta">{file.mime_type || "Unknown type"}</div></td>
                  <td>{project?.event_name ?? "Unassigned"}</td>
                  <td><span className="status">{(file.category || "General").replace(/_/g, " ")}</span></td>
                  <td>{visibilityLabels[file.visibility] ?? file.visibility}</td>
                  <td>{formatSize(file.file_size)}</td>
                  <td>{formatDateTime(file.created_at)}{uploaderName ? <div className="mini-meta">by {uploaderName}</div> : null}</td>
                  <td>
                    {link ? (
                      <ButtonLink href={link} variant="light">View / Download</ButtonLink>
                    ) : (
                      <span className="mini-meta">Storage link unavailable</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!files.length ? (
              <tr>
                <td colSpan={7}>
                  <strong>No files uploaded</strong>
                  <div className="mini-meta">Inquiry PDFs, project documents, and gallery assets will be listed here.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

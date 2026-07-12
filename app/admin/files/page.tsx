import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function AdminFilesPage() {
  return <AdminResourcePage eyebrow="Storage" title="Files" table="files" columns={["file_name", "category", "visibility", "mime_type", "file_size", "created_at"]} />;
}

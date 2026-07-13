import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function FilesPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Storage"
      title="Files"
      description="Project files, inquiry PDFs, client uploads, and public-gallery assets."
      table="files"
      columns={[
        { key: "file_name", label: "File" },
        { key: "category", label: "Category", format: "status" },
        { key: "visibility", label: "Visibility", format: "status" },
        { key: "mime_type", label: "Type" },
        { key: "file_size", label: "Size" },
        { key: "created_at", label: "Uploaded", format: "datetime" },
      ]}
      emptyTitle="No files uploaded"
      emptyDescription="Inquiry PDFs, project documents, and gallery assets will be listed here."
    />
  );
}

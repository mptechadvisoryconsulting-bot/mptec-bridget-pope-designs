import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function DesignUpdatesPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Creative"
      title="Design Updates"
      description="Client-visible design progress, mood board notes, and internal creative status."
      table="design_updates"
      columns={[
        { key: "title", label: "Update" },
        { key: "description", label: "Description" },
        { key: "status", label: "Status", format: "status" },
        { key: "client_visible", label: "Client Visible", format: "boolean" },
        { key: "created_at", label: "Created", format: "datetime" },
      ]}
      emptyTitle="No design updates"
      emptyDescription="Shared design notes will appear in the matching client portal when marked client visible."
    />
  );
}

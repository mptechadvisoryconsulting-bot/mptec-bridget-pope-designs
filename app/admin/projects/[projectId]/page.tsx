import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <AdminWorkspacePage
      eyebrow="Production"
      title="Project Workspace"
      description="Shared admin and client project status, event details, and billing context."
      table="projects"
      detailId={projectId}
      actionHref="/admin/invoices"
      actionLabel="Create Invoice"
      columns={[
        { key: "project_number", label: "Project" },
        { key: "event_name", label: "Event" },
        { key: "event_type", label: "Type" },
        { key: "event_date", label: "Event Date", format: "date" },
        { key: "venue_name", label: "Venue" },
        { key: "city", label: "City" },
        { key: "guest_count", label: "Guests" },
        { key: "budget", label: "Budget" },
        { key: "color_palette", label: "Palette" },
        { key: "theme", label: "Theme" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="Project not found"
      emptyDescription="Project records are created from converted leads."
    />
  );
}

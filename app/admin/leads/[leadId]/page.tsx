import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  return (
    <AdminWorkspacePage
      eyebrow="CRM"
      title="Lead Workspace"
      description="Qualify the consultation request and move the client toward proposal, contract, and deposit."
      table="leads"
      detailId={leadId}
      actionHref="/admin/consultations"
      actionLabel="Schedule Consultation"
      columns={[
        { key: "lead_number", label: "Lead" },
        { key: "first_name", label: "First Name" },
        { key: "last_name", label: "Last Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "event_type", label: "Event Type" },
        { key: "event_date", label: "Event Date", format: "date" },
        { key: "venue", label: "Venue" },
        { key: "city", label: "City" },
        { key: "estimated_budget", label: "Budget" },
        { key: "services_needed", label: "Services" },
        { key: "message", label: "Request Notes" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="Lead not found"
      emptyDescription="This consultation request may have been archived or removed."
    />
  );
}

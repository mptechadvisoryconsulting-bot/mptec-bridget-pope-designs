import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function ConsultationsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Scheduling"
      title="Consultations"
      description="Requested and scheduled consultations created from landing-page inquiries."
      table="consultations"
      select="id,scheduled_at,meeting_type,meeting_link,location,status,notes,created_at,bpd_leads(first_name,last_name,event_type)"
      columns={[
        { key: "bpd_leads.first_name", label: "First Name" },
        { key: "bpd_leads.last_name", label: "Last Name" },
        { key: "bpd_leads.event_type", label: "Event" },
        { key: "scheduled_at", label: "Scheduled", format: "datetime" },
        { key: "meeting_type", label: "Meeting", format: "status" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="No consultations scheduled"
      emptyDescription="New inquiry submissions create requested consultations until the owner schedules a time."
    />
  );
}

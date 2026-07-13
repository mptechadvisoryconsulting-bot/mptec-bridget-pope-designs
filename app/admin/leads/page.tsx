import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function LeadsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="CRM"
      title="Consultation Requests"
      description="Review public inquiry submissions, contact details, event goals, and lead status."
      table="leads"
      detailBaseHref="/admin/leads"
      columns={[
        { key: "lead_number", label: "Lead" },
        { key: "first_name", label: "First Name" },
        { key: "last_name", label: "Last Name" },
        { key: "event_type", label: "Event" },
        { key: "event_date", label: "Date", format: "date" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="No consultation requests yet"
      emptyDescription="New landing-page inquiries will appear here as soon as the public form is submitted."
    />
  );
}

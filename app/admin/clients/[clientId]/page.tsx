import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  return (
    <AdminWorkspacePage
      eyebrow="CRM"
      title="Client Record"
      description="Client account, billing profile, and linked project context."
      table="clients"
      select="id,billing_address,notes,created_at,bpd_profiles(first_name,last_name,email,username,phone,active)"
      detailId={clientId}
      actionHref="/admin/invoices"
      actionLabel="Create Invoice"
      columns={[
        { key: "bpd_profiles.first_name", label: "First Name" },
        { key: "bpd_profiles.last_name", label: "Last Name" },
        { key: "bpd_profiles.email", label: "Email" },
        { key: "bpd_profiles.username", label: "Username" },
        { key: "bpd_profiles.phone", label: "Phone" },
        { key: "billing_address", label: "Billing Address" },
        { key: "notes", label: "Notes" },
        { key: "created_at", label: "Created", format: "datetime" },
      ]}
      emptyTitle="Client not found"
      emptyDescription="Client records are created when a lead converts into a project workspace."
    />
  );
}

import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function ContractsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Documents"
      title="Contracts"
      description="Contract drafts, sent agreements, and signature status for booked projects."
      table="contracts"
      columns={[
        { key: "contract_number", label: "Contract" },
        { key: "status", label: "Status", format: "status" },
        { key: "client_signed_at", label: "Client Signed", format: "datetime" },
        { key: "owner_signed_at", label: "Owner Signed", format: "datetime" },
        { key: "created_at", label: "Created", format: "datetime" },
      ]}
      emptyTitle="No contracts yet"
      emptyDescription="Approved proposals can generate contracts for client signature."
    />
  );
}

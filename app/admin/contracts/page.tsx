import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function ContractsPage() {
  return <AdminResourcePage eyebrow="Documents" title="Contracts" table="contracts" columns={["contract_number", "status", "client_signed_at", "owner_signed_at", "created_at"]} />;
}

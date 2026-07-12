import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function AdminPaymentsPage() {
  return <AdminResourcePage eyebrow="Stripe" title="Payments" table="payments" columns={["amount", "currency", "payment_type", "status", "paid_at", "created_at"]} />;
}

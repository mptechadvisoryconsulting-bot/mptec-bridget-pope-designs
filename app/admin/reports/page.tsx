import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function ReportsPage() {
  return <AdminResourcePage eyebrow="Analytics" title="Reports" table="invoices" columns={["invoice_number", "invoice_type", "total", "amount_paid", "balance_due", "status"]} />;
}

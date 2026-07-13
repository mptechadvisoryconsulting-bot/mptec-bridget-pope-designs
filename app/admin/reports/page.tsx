import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function ReportsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Analytics"
      title="Revenue Reports"
      description="Invoice totals, paid amounts, balances, and status for owner review."
      table="invoices"
      columns={[
        { key: "invoice_number", label: "Invoice" },
        { key: "invoice_type", label: "Type", format: "status" },
        { key: "total", label: "Total", format: "currency" },
        { key: "amount_paid", label: "Paid", format: "currency" },
        { key: "balance_due", label: "Balance", format: "currency" },
        { key: "status", label: "Status", format: "status" },
      ]}
      emptyTitle="No reporting data"
      emptyDescription="Invoices and Stripe webhook confirmations will populate these revenue reports."
    />
  );
}

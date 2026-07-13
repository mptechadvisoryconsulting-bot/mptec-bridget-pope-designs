import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function AdminPaymentsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Stripe"
      title="Payments"
      description="Confirmed Stripe payments, fees, refunds, disputes, and payout-linked accounting."
      table="payments"
      columns={[
        { key: "amount", label: "Amount", format: "currency" },
        { key: "platform_fee_amount", label: "Platform Fee", format: "currency" },
        { key: "stripe_processing_fee", label: "Stripe Fee", format: "currency" },
        { key: "status", label: "Status", format: "status" },
        { key: "paid_at", label: "Paid", format: "datetime" },
        { key: "created_at", label: "Created", format: "datetime" },
      ]}
      emptyTitle="No confirmed payments"
      emptyDescription="Stripe webhook confirmations will create immutable paid records here."
    />
  );
}

import { PaymentCard } from "@/components/client/PaymentCard";
import { ClientSectionPage } from "@/components/client/ClientSectionPage";

export default function PaymentsPage() {
  return (
    <>
      <ClientSectionPage eyebrow="Payments" title="Invoices, Payments, and Receipts" />
      <div style={{ marginTop: 16 }}>
        <PaymentCard />
      </div>
    </>
  );
}

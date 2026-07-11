import { ClientSectionPage } from "@/components/client/ClientSectionPage";

export default async function ClientInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <ClientSectionPage eyebrow={`Invoice ${invoiceId}`} title="Invoice Detail" />;
}

import { AdminSectionPage } from "@/components/admin/AdminSectionPage";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <AdminSectionPage eyebrow={`Invoice ${invoiceId}`} title="Invoice Detail" icon="proposal" />;
}

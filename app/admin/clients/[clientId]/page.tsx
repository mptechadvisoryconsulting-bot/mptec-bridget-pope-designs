import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <AdminResourcePage eyebrow={`Client ${clientId}`} title="Client Record" table="clients" detailId={clientId} actionHref="/admin/invoices" actionLabel="Create Invoice" />;
}

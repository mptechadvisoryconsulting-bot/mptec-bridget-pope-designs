import { AdminSectionPage } from "@/components/admin/AdminSectionPage";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <AdminSectionPage eyebrow={`Client ${clientId}`} title="Client Record" icon="people" />;
}

import { ClientSidebar } from "@/components/client/ClientSidebar";
import { requireClientPortalContext } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireClientPortalContext("/client/dashboard");

  return (
    <div className="app-shell client-shell">
      <ClientSidebar />
      <main className="client-main">{children}</main>
    </div>
  );
}

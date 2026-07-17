import { ClientSidebar } from "@/components/client/ClientSidebar";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { requireClientPortalContext } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const context = await requireClientPortalContext("/client/dashboard");

  return (
    <div className="app-shell client-shell">
      <ClientSidebar />
      <main className="client-main">
        <RealtimeRefresh userId={context.profile.id} />
        {children}
      </main>
    </div>
  );
}

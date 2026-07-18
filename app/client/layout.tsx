import { ClientSidebar } from "@/components/client/ClientSidebar";
import { OwnerClientPortalGate } from "@/components/client/OwnerClientPortalGate";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { requireClientPortalContext } from "@/lib/client-portal";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login?next=/client/dashboard");
  }

  if (!profile.active) {
    redirect("/auth/login?error=profile");
  }

  if (adminRoles.has(profile.role)) {
    return <OwnerClientPortalGate role={profile.role} />;
  }

  if (profile.role !== "client") {
    redirect("/auth/login?error=profile");
  }

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

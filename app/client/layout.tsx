import { ClientSidebar } from "@/components/client/ClientSidebar";
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

  // redirect() skips rendering child /client pages, so owner sessions are not
  // forced through requireClientPortalContext in dashboard/etc.
  if (adminRoles.has(profile.role)) {
    redirect("/auth/client-portal");
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

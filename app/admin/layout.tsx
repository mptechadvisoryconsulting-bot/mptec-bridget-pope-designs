import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login?next=/admin");
  }

  if (!profile.active || !adminRoles.has(profile.role)) {
    redirect(profile.role === "client" ? "/client/dashboard" : "/auth/login?error=profile");
  }

  const supabase = createAdminClient();
  const [{ data: settings }, { count: contractCount }] = await Promise.all([
    supabase
      .from("business_settings")
      .select("show_inventory_nav,show_team_nav,show_contracts_nav")
      .limit(1)
      .maybeSingle(),
    supabase.from("contracts").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="app-shell admin-shell">
      <AdminSidebar
        flags={{
          showInventoryNav: settings?.show_inventory_nav ?? false,
          showTeamNav: settings?.show_team_nav ?? false,
          showContractsNav: settings?.show_contracts_nav !== false,
          hasContracts: (contractCount ?? 0) > 0,
        }}
      />
      <main className="portal-main">
        <RealtimeRefresh userId={profile.id} />
        {children}
      </main>
    </div>
  );
}

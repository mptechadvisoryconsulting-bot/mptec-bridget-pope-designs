import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login?next=/admin");
  }

  if (!profile.active || !adminRoles.has(profile.role)) {
    redirect(profile.role === "client" ? "/client/dashboard" : "/auth/login?error=profile");
  }

  return (
    <div className="app-shell admin-shell">
      <AdminSidebar />
      <main className="portal-main">{children}</main>
    </div>
  );
}

import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell admin-shell">
      <AdminSidebar />
      <main className="portal-main">{children}</main>
    </div>
  );
}

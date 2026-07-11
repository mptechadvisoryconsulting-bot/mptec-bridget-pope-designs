import { ClientSidebar } from "@/components/client/ClientSidebar";

export const dynamic = "force-dynamic";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell client-shell">
      <ClientSidebar />
      <main className="client-main">{children}</main>
    </div>
  );
}

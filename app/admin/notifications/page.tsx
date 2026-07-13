import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

type ProfileRef = { first_name?: string | null; last_name?: string | null; role?: string | null };

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
  read_at?: string | null;
  created_at: string;
  bpd_profiles?: ProfileRef | ProfileRef[] | null;
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ action?: string; id?: string }> }) {
  const { action, id } = await searchParams;
  const supabase = createAdminClient();

  if (action === "read" && id) {
    await markNotificationRead(supabase, id);
    redirect("/admin/notifications");
  }
  if (action === "read-all") {
    await markAllNotificationsRead(supabase);
    redirect("/admin/notifications");
  }

  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,message,action_url,read_at,created_at,bpd_profiles(first_name,last_name,role)")
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as NotificationRow[];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Realtime</span>
          <h1>Notifications</h1>
          <p className="mini-meta">Owner and admin alerts from inquiries, messages, invoices, and automations.</p>
        </div>
        <div className="topbar-actions">
          <span className="status">{unreadCount} unread</span>
          {unreadCount ? <ButtonLink href="/admin/notifications?action=read-all" variant="secondary">Mark All Read</ButtonLink> : null}
        </div>
      </div>

      <section className="panel">
        <ul className="list">
          {notifications.map((notification) => {
            const destination = first(notification.bpd_profiles);
            const destinationName = [destination?.first_name, destination?.last_name].filter(Boolean).join(" ") || destination?.role || "Owner";

            return (
              <li key={notification.id}>
                <span>
                  <strong>{notification.title}</strong>
                  <span className="mini-meta">{notification.message}</span>
                  <span className="mini-meta">To {destinationName} · {formatDateTime(notification.created_at)}</span>
                </span>
                <div className="topbar-actions">
                  <span className="status">{notification.read_at ? "Read" : "Unread"}</span>
                  {notification.action_url ? <ButtonLink href={notification.action_url} variant="light">Open</ButtonLink> : null}
                  {!notification.read_at ? <ButtonLink href={`/admin/notifications?action=read&id=${notification.id}`} variant="light">Mark Read</ButtonLink> : null}
                </div>
              </li>
            );
          })}
          {!notifications.length ? <li>No notifications yet. New consultation requests, payment events, and client messages will create notifications.</li> : null}
        </ul>
      </section>
    </div>
  );
}

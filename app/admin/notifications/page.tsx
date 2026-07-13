import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function NotificationsPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Realtime"
      title="Notifications"
      description="Unread and historical owner/admin alerts from inquiries, messages, invoices, and automations."
      table="notifications"
      columns={[
        { key: "type", label: "Type", format: "status" },
        { key: "title", label: "Title" },
        { key: "message", label: "Message" },
        { key: "action_url", label: "Action" },
        { key: "read_at", label: "Read", format: "datetime" },
        { key: "created_at", label: "Created", format: "datetime" },
      ]}
      emptyTitle="No notifications"
      emptyDescription="New consultation requests, payment events, and client messages will create notifications."
    />
  );
}

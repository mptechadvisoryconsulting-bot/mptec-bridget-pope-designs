import { createAdminClient } from "@/lib/supabase/admin";

type NotificationInput = {
  recipient_id: string;
  project_id?: string | null;
  lead_id?: string | null;
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
};

export async function createNotifications(notifications: NotificationInput[]) {
  if (!notifications.length) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) throw new Error(error.message);
}

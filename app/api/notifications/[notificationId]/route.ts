import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(_request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: notification, error: lookupError } = await supabase
    .from("notifications")
    .select("id,recipient_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (lookupError) {
    console.error("notification_lookup_failed", { notificationId, code: lookupError.code, message: lookupError.message });
    return NextResponse.json({ success: false, message: "Notification not found." }, { status: 404 });
  }

  if (!notification || (notification.recipient_id !== profile.id && !adminRoles.has(profile.role))) {
    return NextResponse.json({ success: false, message: "Notification not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();
  if (error) {
    console.error("notification_update_failed", { notificationId, code: error.code, message: error.message });
    return NextResponse.json({ success: false, message: "Unable to update notification." }, { status: 400 });
  }
  return NextResponse.json({ success: true, notification: data });
}

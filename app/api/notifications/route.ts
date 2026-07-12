import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const requestedRecipientId = new URL(request.url).searchParams.get("recipientId");
  const recipientId = adminRoles.has(profile.role) && requestedRecipientId ? requestedRecipientId : profile.id;
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .is("read_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, notifications: data });
}

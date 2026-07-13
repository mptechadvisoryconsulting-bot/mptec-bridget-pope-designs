import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const isAdmin = adminRoles.has(profile.role);

  let conversationIds: string[] = [];

  if (isAdmin) {
    const { data, error } = await supabase.from("conversations").select("id");
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    conversationIds = (data ?? []).map((row) => row.id);
  } else {
    const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("profile_id", profile.id).maybeSingle();
    if (clientError) return NextResponse.json({ success: false, message: clientError.message }, { status: 400 });

    if (client?.id) {
      const { data, error } = await supabase.from("conversations").select("id").eq("client_id", client.id);
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      conversationIds = (data ?? []).map((row) => row.id);
    }
  }

  if (!conversationIds.length) {
    return NextResponse.json({ success: true, unreadCount: 0 });
  }

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .neq("sender_id", profile.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, unreadCount: count ?? 0 });
}
